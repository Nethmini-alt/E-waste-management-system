using EWasteManagement.API.Features.Workflow.Entities;
using EWasteManagement.API.Features.Workflow.Services;

namespace EWasteManagement.API.Infrastructure.BackgroundTasks;

/// <summary>
/// Dequeues workflow ids and drives them through the orchestrator, entirely
/// outside any HTTP request's lifetime. This is what lets Create Submission
/// return immediately: the actual Planner -> Analyzer -> Validator -> Matcher
/// chain (including a possible pause for human approval) runs here instead.
/// </summary>
public class WorkflowQueueProcessor : BackgroundService
{
    private readonly IWorkflowBackgroundQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<WorkflowQueueProcessor> _logger;

    public WorkflowQueueProcessor(
        IWorkflowBackgroundQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<WorkflowQueueProcessor> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await foreach (var workflowId in _queue.DequeueAllAsync(stoppingToken))
        {
            // Scope created OUTSIDE the try — the catch block needs it too,
            // to mark the workflow Failed. Previously the scope only existed
            // inside the try, so a caught exception had no way to reach the
            // database and the workflow was left silently stuck at whatever
            // status it was on before the failure — indistinguishable from
            // "still working".
            using var scope = _scopeFactory.CreateScope();

            try
            {
                var orchestrator = scope.ServiceProvider.GetRequiredService<IWorkflowOrchestrationService>();
                await orchestrator.RunChainAsync(workflowId, stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Workflow {WorkflowId} failed in the background queue", workflowId);

                try
                {
                    var workflows = scope.ServiceProvider.GetRequiredService<IWorkflowService>();
                    await workflows.SetStatusAsync(workflowId, WorkflowStatus.Failed, stoppingToken);
                    await workflows.LogExecutionAsync(new EWasteManagement.API.Features.Workflow.DTOs.ExecutionLogRequest
                    {
                        WorkflowId = workflowId,
                        AgentName = "Orchestrator",
                        StepNumber = 0,
                        InputJson = new { },
                        Succeeded = false,
                        ErrorMessage = ex.Message,
                    }, stoppingToken);
                }
                catch (Exception markFailedEx)
                {
                    // Marking Failed must never itself take down the
                    // processor loop — the next queued item still deserves
                    // to run even if the database is briefly unreachable.
                    _logger.LogError(markFailedEx, "Also failed to mark workflow {WorkflowId} as Failed", workflowId);
                }
            }
        }
    }
}