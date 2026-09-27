using EWasteManagement.API.Features.Workflow.Entities;
using EWasteManagement.API.Infrastructure.BackgroundTasks;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace EWasteManagement.Tests.Workflow;

/// <summary>
/// Startup recovery re-queues every workflow a restart interrupted mid-chain,
/// and leaves PendingApproval (waiting for an admin) and finished workflows alone.
/// </summary>
public class WorkflowStartupRecoveryTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ServiceProvider _services = null!;
    private readonly RecordingQueue _queue = new();

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;

        _services = new ServiceCollection()
            .AddScoped(_ => new ApplicationDbContext(options, new NoOpDomainEventDispatcher()))
            .BuildServiceProvider();

        using var scope = _services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _services.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private WorkflowStartupRecovery CreateRecovery(Dictionary<string, string?>? settings = null) => new(
        _services.GetRequiredService<IServiceScopeFactory>(),
        _queue,
        new ConfigurationBuilder().AddInMemoryCollection(settings ?? new()).Build(),
        NullLogger<WorkflowStartupRecovery>.Instance);

    private async Task<Dictionary<WorkflowStatus, Guid>> SeedOneWorkflowPerStatusAsync()
    {
        using var scope = _services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var ids = new Dictionary<WorkflowStatus, Guid>();
        var createdAt = DateTime.UtcNow.AddHours(-1);
        foreach (var status in Enum.GetValues<WorkflowStatus>())
        {
            var workflow = new CollectionWorkflow
            {
                SubmissionId = Guid.NewGuid(),
                Status = status,
                CreatedAt = createdAt = createdAt.AddMinutes(1),
            };
            db.CollectionWorkflows.Add(workflow);
            ids[status] = workflow.WorkflowId;
        }
        await db.SaveChangesAsync();
        return ids;
    }

    [Theory]
    [InlineData(WorkflowStatus.Planning)]
    [InlineData(WorkflowStatus.Analyzing)]
    [InlineData(WorkflowStatus.Validating)]
    [InlineData(WorkflowStatus.Matching)]
    [InlineData(WorkflowStatus.Finalizing)]
    public async Task In_progress_workflow_is_requeued(WorkflowStatus status)
    {
        var ids = await SeedOneWorkflowPerStatusAsync();

        await CreateRecovery().StartAsync(CancellationToken.None);

        Assert.Contains(ids[status], _queue.Enqueued);
    }

    [Fact]
    public async Task Pending_approval_workflow_is_not_requeued()
    {
        var ids = await SeedOneWorkflowPerStatusAsync();

        await CreateRecovery().StartAsync(CancellationToken.None);

        Assert.DoesNotContain(ids[WorkflowStatus.PendingApproval], _queue.Enqueued);
    }

    [Theory]
    [InlineData(WorkflowStatus.Completed)]
    [InlineData(WorkflowStatus.Rejected)]
    [InlineData(WorkflowStatus.Failed)]
    public async Task Finished_workflow_is_not_requeued(WorkflowStatus status)
    {
        var ids = await SeedOneWorkflowPerStatusAsync();

        await CreateRecovery().StartAsync(CancellationToken.None);

        Assert.DoesNotContain(ids[status], _queue.Enqueued);
    }

    [Fact]
    public async Task Exactly_the_five_in_progress_workflows_are_requeued_once_each_oldest_first()
    {
        var ids = await SeedOneWorkflowPerStatusAsync();

        await CreateRecovery().StartAsync(CancellationToken.None);

        // Workflows were seeded in enum order with increasing CreatedAt, and
        // InterruptedStatuses lists its statuses in that same enum order.
        var expected = WorkflowStartupRecovery.InterruptedStatuses.Select(s => ids[s]);
        Assert.Equal(expected, _queue.Enqueued);
    }

    [Fact]
    public async Task Nothing_is_requeued_when_recovery_is_disabled()
    {
        await SeedOneWorkflowPerStatusAsync();

        await CreateRecovery(new() { ["Workflow:RecoverOnStartup"] = "false" }).StartAsync(CancellationToken.None);

        Assert.Empty(_queue.Enqueued);
    }

    [Fact]
    public async Task A_database_failure_does_not_stop_api_startup()
    {
        await _connection.CloseAsync();   // every query now fails

        var exception = await Record.ExceptionAsync(() => CreateRecovery().StartAsync(CancellationToken.None));

        Assert.Null(exception);
        Assert.Empty(_queue.Enqueued);
    }

    private sealed class RecordingQueue : IWorkflowBackgroundQueue
    {
        public List<Guid> Enqueued { get; } = new();
        public void Enqueue(Guid workflowId) => Enqueued.Add(workflowId);
        public IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken ct) => throw new NotSupportedException();
    }
}
