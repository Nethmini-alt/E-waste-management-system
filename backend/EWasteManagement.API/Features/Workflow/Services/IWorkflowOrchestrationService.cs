namespace EWasteManagement.API.Features.Workflow.Services;

/// <summary>
/// Drives one workflow through as many steps as it can before either
/// finishing (Completed/Failed) or hitting a stop it can't pass without a
/// human (PendingApproval). Safe to call repeatedly on the same workflow —
/// it always reads the CURRENT status and continues from there, which is
/// what makes "approve, then re-enqueue" work as a resume rather than a
/// restart-from-scratch.
/// </summary>
public interface IWorkflowOrchestrationService
{
    /// <summary>
    /// Queues an already-saved workflow for the background chain. Call only
    /// after the workflow row has been committed (see IWorkflowService.Add).
    /// </summary>
    void Start(Guid workflowId);
    Task RunChainAsync(Guid workflowId, CancellationToken ct = default);

    /// <summary>
    /// Called after staff approve a PendingApproval workflow. Figures out
    /// which stage to resume at (Matching if Matcher hasn't run yet,
    /// Finalizing if it already has) and re-enqueues.
    /// </summary>
    Task ResumeAfterApprovalAsync(Guid workflowId, CancellationToken ct = default);
}
