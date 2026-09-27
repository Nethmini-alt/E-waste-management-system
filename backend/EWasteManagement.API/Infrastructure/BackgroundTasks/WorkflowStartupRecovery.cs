using EWasteManagement.API.Features.Workflow.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Infrastructure.BackgroundTasks;

/// <summary>
/// Runs once at API startup. The workflow queue is in memory, so a restart or
/// crash loses every workflow that was mid-chain; this puts them back on the
/// queue so WorkflowQueueProcessor picks them up where they stopped
/// (RunChainAsync always resumes from the stored status).
///
/// PendingApproval is deliberately left alone: those workflows are waiting for
/// an admin, and the approve endpoint re-queues them itself.
///
/// Set "Workflow:RecoverOnStartup" to false on any extra API instance that
/// shares the database (e.g. a local test instance), otherwise both instances
/// would process the same workflows.
/// </summary>
public class WorkflowStartupRecovery : IHostedService
{
    public static readonly WorkflowStatus[] InterruptedStatuses =
    {
        WorkflowStatus.Planning,
        WorkflowStatus.Analyzing,
        WorkflowStatus.Validating,
        WorkflowStatus.Matching,
        WorkflowStatus.Finalizing,
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly IWorkflowBackgroundQueue _queue;
    private readonly IConfiguration _config;
    private readonly ILogger<WorkflowStartupRecovery> _logger;

    public WorkflowStartupRecovery(
        IServiceScopeFactory scopeFactory,
        IWorkflowBackgroundQueue queue,
        IConfiguration config,
        ILogger<WorkflowStartupRecovery> logger)
    {
        _scopeFactory = scopeFactory;
        _queue = queue;
        _config = config;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!_config.GetValue("Workflow:RecoverOnStartup", true))
        {
            _logger.LogInformation("Workflow startup recovery is disabled (Workflow:RecoverOnStartup = false).");
            return;
        }

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

            var workflowIds = await db.CollectionWorkflows
                .AsNoTracking()
                .Where(w => InterruptedStatuses.Contains(w.Status))
                .OrderBy(w => w.CreatedAt)
                .Select(w => w.WorkflowId)
                .ToListAsync(cancellationToken);

            foreach (var workflowId in workflowIds)
                _queue.Enqueue(workflowId);

            if (workflowIds.Count > 0)
                _logger.LogInformation("Re-queued {Count} interrupted workflow(s) at startup: {WorkflowIds}",
                    workflowIds.Count, workflowIds);
        }
        catch (Exception ex)
        {
            // Never block API startup over this. The workflows keep their
            // stored status, so the next restart tries again.
            _logger.LogError(ex, "Workflow startup recovery failed; interrupted workflows were not re-queued.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
