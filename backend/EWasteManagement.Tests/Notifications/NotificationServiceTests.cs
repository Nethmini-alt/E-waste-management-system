using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Entities;
using EWasteManagement.Api.Services;
using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Notifications.Entities;
using EWasteManagement.API.Features.Notifications.Services;
using EWasteManagement.API.Features.Workflow.DTOs;
using EWasteManagement.API.Features.Workflow.Entities;
using EWasteManagement.API.Features.Workflow.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace EWasteManagement.Tests.Notifications;

/// <summary>
/// Locks in the in-app notification rules behind the header bell:
///  - rows are per-user and every read is scoped to that user;
///  - role fan-out reaches exactly the active users holding those roles;
///  - marking read never touches someone else's rows;
///  - the producers wired into the system (submission created, workflow
///    decided) actually raise the notifications the bell depends on.
/// </summary>
public class NotificationServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private NotificationService _service = null!;

    private readonly Guid _alice = Guid.NewGuid();
    private readonly Guid _bob = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        _db = NewContext();
        await _db.Database.EnsureCreatedAsync();

        // Notification rows FK to users, and NotifyAsync drops ids without an
        // account — give both protagonists real rows up front.
        _db.Users.AddRange(
            NewUser(_alice, UserRole.Household),
            NewUser(_bob, UserRole.Household));
        await _db.SaveChangesAsync();

        _service = new NotificationService(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private ApplicationDbContext NewContext()
    {
        var builder = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection);
        return new ApplicationDbContext(builder.Options, new NoOpDomainEventDispatcher());
    }

    // ---------- Create + read ----------

    [Fact]
    public async Task Notify_creates_an_unread_row_visible_to_its_owner_only()
    {
        await _service.NotifyAsync(_alice, "Pickup completed", "Collected 12 kg.",
            NotificationType.Success, link: "/submissions/mine");

        var mine = await _service.GetForUserAsync(_alice);
        var other = await _service.GetForUserAsync(_bob);

        var row = Assert.Single(mine);
        Assert.Equal("Pickup completed", row.Title);
        Assert.Equal("success", row.Type);
        Assert.Equal("/submissions/mine", row.Link);
        Assert.False(row.IsRead);
        Assert.Empty(other);
        Assert.Equal(1, await _service.GetUnreadCountAsync(_alice));
        Assert.Equal(0, await _service.GetUnreadCountAsync(_bob));
    }

    [Fact]
    public async Task Notify_for_an_unknown_user_is_dropped_instead_of_throwing()
    {
        await _service.NotifyAsync(Guid.NewGuid(), "Ghost", "No account behind this id.");

        Assert.Empty(await _service.GetForUserAsync(_alice));
    }

    [Fact]
    public async Task List_is_newest_first_and_honours_the_limit()
    {
        await _service.NotifyAsync(_alice, "First", "1");
        await Task.Delay(5); // CreatedAt has second-level ties otherwise
        await _service.NotifyAsync(_alice, "Second", "2");
        await Task.Delay(5);
        await _service.NotifyAsync(_alice, "Third", "3");

        var list = await _service.GetForUserAsync(_alice, limit: 2);

        Assert.Equal(new[] { "Third", "Second" }, list.Select(n => n.Title));
    }

    // ---------- Role fan-out ----------

    [Fact]
    public async Task Role_fanout_reaches_only_active_users_holding_those_roles()
    {
        var staff = await SeedUserAsync(UserRole.Staff, isActive: true);
        var admin = await SeedUserAsync(UserRole.Admin, isActive: true);
        var inactiveAdmin = await SeedUserAsync(UserRole.Admin, isActive: false);
        var household = await SeedUserAsync(UserRole.Household);

        await _service.NotifyRolesAsync(
            new[] { UserRole.Staff, UserRole.Admin },
            "New submission awaiting review", "One is waiting.");

        Assert.Single(await _service.GetForUserAsync(staff.UserId));
        Assert.Single(await _service.GetForUserAsync(admin.UserId));
        Assert.Empty(await _service.GetForUserAsync(inactiveAdmin.UserId));
        Assert.Empty(await _service.GetForUserAsync(household.UserId));
    }

    // ---------- Marking read ----------

    [Fact]
    public async Task MarkAsRead_flips_only_the_callers_row_and_survives_a_repeat()
    {
        await _service.NotifyAsync(_alice, "For Alice", "1");
        await _service.NotifyAsync(_bob, "For Bob", "2");
        var mine = Assert.Single(await _service.GetForUserAsync(_alice));

        // Bob cannot mark Alice's notification — 404 territory for the controller.
        Assert.False(await _service.MarkAsReadAsync(_bob, mine.Id));
        Assert.False((await _service.GetForUserAsync(_alice)).Single().IsRead);

        Assert.True(await _service.MarkAsReadAsync(_alice, mine.Id));
        Assert.True(await _service.MarkAsReadAsync(_alice, mine.Id)); // idempotent re-post
        Assert.Equal(0, await _service.GetUnreadCountAsync(_alice));

        // Bob's row is untouched.
        Assert.Equal(1, await _service.GetUnreadCountAsync(_bob));
    }

    [Fact]
    public async Task MarkAllAsRead_clears_only_the_callers_unread_rows()
    {
        await _service.NotifyAsync(_alice, "A", "1");
        await _service.NotifyAsync(_alice, "B", "2");
        await _service.NotifyAsync(_bob, "C", "3");

        Assert.Equal(2, await _service.MarkAllAsReadAsync(_alice));

        Assert.Equal(0, await _service.GetUnreadCountAsync(_alice));
        Assert.Equal(1, await _service.GetUnreadCountAsync(_bob));
        Assert.Equal(0, await _service.MarkAllAsReadAsync(_alice)); // nothing left
    }

    // ---------- Producers wired into the system ----------

    [Fact]
    public async Task Creating_a_submission_notifies_active_staff_and_admin()
    {
        var staff = await SeedUserAsync(UserRole.Staff);
        var admin = await SeedUserAsync(UserRole.Admin);
        var household = await SeedUserAsync(UserRole.Household);

        var service = CreateSubmissionService();
        await service.CreateSubmissionAsync(NewSubmissionDto(), _alice, "Household");

        var staffNote = Assert.Single(await _service.GetForUserAsync(staff.UserId));
        Assert.Equal("New submission awaiting review", staffNote.Title);
        Assert.Equal("/submissions/review", staffNote.Link);
        Assert.Single(await _service.GetForUserAsync(admin.UserId));
        Assert.Empty(await _service.GetForUserAsync(household.UserId));
    }

    [Fact]
    public async Task Approving_a_workflow_notifies_the_submission_owner()
    {
        var submission = new Submission
        {
            UserId = _alice,
            Category = "IT Equipment",
            PickupAddress = "12 Main St",
            PhoneNumber = "0771234567",
        };
        _db.Submissions.Add(submission);
        var workflow = new CollectionWorkflow { SubmissionId = submission.Id, Status = WorkflowStatus.PendingApproval };
        _db.CollectionWorkflows.Add(workflow);
        await _db.SaveChangesAsync();

        var workflows = new WorkflowService(_db, new ConfigurationBuilder().Build(), _service);
        await workflows.RecordApprovalActionAsync(
            workflow.WorkflowId, WorkflowApprovalActionType.Approved, _bob, "Looks good.");

        var note = Assert.Single(await _service.GetForUserAsync(_alice));
        Assert.Equal("Submission approved", note.Title);
        Assert.Equal("success", note.Type);
        Assert.Equal("/submissions/mine", note.Link);
        Assert.Empty(await _service.GetForUserAsync(_bob)); // the deciding staff member hears nothing
    }

    // ---------- Helpers ----------

    private SubmissionService CreateSubmissionService()
    {
        var workflows = new WorkflowService(_db, new ConfigurationBuilder().Build(), _service);
        return new SubmissionService(_db, workflows, new NoOpOrchestrator(), _service);
    }

    private static CreateSubmissionDto NewSubmissionDto() => new()
    {
        Category = "IT Equipment",
        EstimatedWeight = 3m,
        PickupAddress = "12 Main St, Colombo",
        PhoneNumber = "0771234567",
        Items = new()
        {
            new CreateSubmissionItemDto { ItemName = "Laptop", Description = "Old laptop", ImageUrl = "https://example.com/a.jpg" },
        },
    };

    private async Task<User> SeedUserAsync(UserRole role, bool isActive = true)
    {
        var user = NewUser(Guid.NewGuid(), role);
        user.IsActive = isActive;
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    private static User NewUser(Guid userId, UserRole role) => new()
    {
        UserId = userId,
        Email = $"{userId}@test.com",
        FullName = "Test User",
        PasswordHash = "x",
        Role = role,
        StaffType = role == UserRole.Staff ? StaffType.Management : null,
    };

    private sealed class NoOpOrchestrator : IWorkflowOrchestrationService
    {
        public void Start(Guid workflowId) { }
        public Task RunChainAsync(Guid workflowId, CancellationToken ct = default) => Task.CompletedTask;
        public Task ResumeAfterApprovalAsync(Guid workflowId, CancellationToken ct = default) => Task.CompletedTask;
    }
}

