using EWasteManagement.API.Features.Workflow.DTOs;
using EWasteManagement.API.Features.Workflow.Entities;

namespace EWasteManagement.API.Features.Workflow.Services;

/// <summary>
/// Plain data operations on CollectionWorkflow — read/write only, no
/// sequencing logic. WorkflowOrchestrationService is what decides WHEN to
/// call each of these; this just persists.
/// </summary>
public interface IWorkflowService
{
    /// <summary>
    /// Stages a new Planning workflow on the shared DbContext WITHOUT saving,
    /// so the caller can commit it in the same SaveChanges as the submission.
    /// </summary>
    CollectionWorkflow Add(Guid submissionId);
    Task<CollectionWorkflow> CreateAsync(Guid submissionId, CancellationToken ct = default);
    Task<CollectionWorkflow?> GetAsync(Guid workflowId, CancellationToken ct = default);
    Task<List<CollectionWorkflow>> ListAsync(string? status, CancellationToken ct = default);

    Task RecordPlanAsync(Guid workflowId, PlanResultRequest request, CancellationToken ct = default);
    Task RecordAnalyzerResultAsync(Guid workflowId, AnalyzerResultRequest request, CancellationToken ct = default);
    Task RecordValidatorResultAsync(Guid workflowId, ValidatorResultRequest request, CancellationToken ct = default);
    Task RecordMatcherResultAsync(Guid workflowId, MatcherResultRequest request, CancellationToken ct = default);
    Task RecordFinalizeAsync(Guid workflowId, FinalizeResultRequest request, Guid? resultingJobId, CancellationToken ct = default);
    Task SetStatusAsync(Guid workflowId, WorkflowStatus status, CancellationToken ct = default);

    Task<SubmissionSnapshotResponse?> GetSubmissionSnapshotAsync(Guid submissionId, CancellationToken ct = default);
    Task<BusinessRulesResponse> GetBusinessRulesAsync(CancellationToken ct = default);

    Task<WorkflowApprovalAction> RecordApprovalActionAsync(
        Guid workflowId, WorkflowApprovalActionType actionType, Guid performedByUserId,
        string? comments, CancellationToken ct = default);

    Task LogExecutionAsync(ExecutionLogRequest request, CancellationToken ct = default);
    Task<List<AgentExecutionLog>> GetExecutionLogAsync(Guid workflowId, CancellationToken ct = default);
}
