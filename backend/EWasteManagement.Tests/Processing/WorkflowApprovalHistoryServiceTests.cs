using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Features.Workflow.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

// Read-only view over the existing workflow approval records (used by the Processing Agentic Review page).
public class WorkflowApprovalHistoryServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private WorkflowApprovalHistoryService _service = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();
        _service = new WorkflowApprovalHistoryService(_db);
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); await _connection.DisposeAsync(); }

    [Fact]
    public async Task GetAsync_ReturnsActionsOldestFirst_WithApproverNameAndComment()
    {
        var admin = new User { Email = $"{Guid.NewGuid()}@test.com", FullName = "Admin Person", PasswordHash = "secret", Role = UserRole.Admin };
        _db.Users.Add(admin);
        var workflow = new CollectionWorkflow { SubmissionId = Guid.NewGuid(), Status = WorkflowStatus.Matching };
        _db.CollectionWorkflows.Add(workflow);
        var start = new DateTime(2026, 9, 1, 10, 0, 0, DateTimeKind.Utc);
        _db.WorkflowApprovalActions.Add(new WorkflowApprovalAction
        {
            WorkflowId = workflow.WorkflowId, ActionType = WorkflowApprovalActionType.Approved,
            PerformedByUserId = admin.UserId, Comments = "Looks fine", PerformedAt = start.AddHours(2)
        });
        _db.WorkflowApprovalActions.Add(new WorkflowApprovalAction
        {
            WorkflowId = workflow.WorkflowId, ActionType = WorkflowApprovalActionType.Submitted,
            PerformedByUserId = admin.UserId, PerformedAt = start
        });
        await _db.SaveChangesAsync();

        var result = await _service.GetAsync(workflow.WorkflowId);

        Assert.Equal(new[] { "Submitted", "Approved" }, result.Select(a => a.ActionType));
        Assert.All(result, a => Assert.Equal("Admin Person", a.PerformedByName));
        Assert.Equal("Looks fine", result[1].Comments);
    }

    [Fact]
    public async Task GetAsync_OtherWorkflowsActionsAreNotIncluded()
    {
        var admin = new User { Email = $"{Guid.NewGuid()}@test.com", FullName = "Admin Person", PasswordHash = "x", Role = UserRole.Admin };
        _db.Users.Add(admin);
        var a = new CollectionWorkflow { SubmissionId = Guid.NewGuid() };
        var b = new CollectionWorkflow { SubmissionId = Guid.NewGuid() };
        _db.CollectionWorkflows.AddRange(a, b);
        _db.WorkflowApprovalActions.Add(new WorkflowApprovalAction { WorkflowId = b.WorkflowId, ActionType = WorkflowApprovalActionType.Rejected, PerformedByUserId = admin.UserId });
        await _db.SaveChangesAsync();

        Assert.Empty(await _service.GetAsync(a.WorkflowId));
        Assert.Single(await _service.GetAsync(b.WorkflowId));
    }

    [Fact]
    public async Task GetAsync_UnknownWorkflow_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetAsync(Guid.NewGuid()));
    }
}
