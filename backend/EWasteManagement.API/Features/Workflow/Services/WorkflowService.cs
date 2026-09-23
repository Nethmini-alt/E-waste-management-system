using System.Text.Json;
using EWasteManagement.API.Features.Workflow.DTOs;
using EWasteManagement.API.Features.Workflow.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Workflow.Services;

public class WorkflowService : IWorkflowService
{
    private readonly ApplicationDbContext _db;
    private readonly IConfiguration _config;

    public WorkflowService(ApplicationDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public async Task<CollectionWorkflow> CreateAsync(Guid submissionId, CancellationToken ct = default)
    {
        var workflow = new CollectionWorkflow
        {
            SubmissionId = submissionId,
            Status = WorkflowStatus.Planning,
        };
        _db.CollectionWorkflows.Add(workflow);
        await _db.SaveChangesAsync(ct);
        return workflow;
    }

    public Task<CollectionWorkflow?> GetAsync(Guid workflowId, CancellationToken ct = default) =>
        _db.CollectionWorkflows.FirstOrDefaultAsync(w => w.WorkflowId == workflowId, ct);

    public async Task<List<CollectionWorkflow>> ListAsync(string? status, CancellationToken ct = default)
    {
        var query = _db.CollectionWorkflows.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(status) && Enum.TryParse<WorkflowStatus>(status, true, out var parsed))
            query = query.Where(w => w.Status == parsed);

        return await query.OrderByDescending(w => w.CreatedAt).ToListAsync(ct);
    }

    public async Task RecordPlanAsync(Guid workflowId, PlanResultRequest request, CancellationToken ct = default)
    {
        var workflow = await RequireAsync(workflowId, ct);

        // skipMatcher is stored INSIDE the PlanJson blob rather than as its
        // own column — the orchestrator reads it back out when it needs to
        // decide whether to call Matcher, so we don't need a migration just
        // for one boolean.
        var planWithFlag = new { plan = request.PlanJson, skipMatcher = request.SkipMatcher, reasoning = request.Reasoning };
        workflow.PlanJson = JsonSerializer.Serialize(planWithFlag);
        workflow.Status = WorkflowStatus.Analyzing;
        workflow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task RecordAnalyzerResultAsync(Guid workflowId, AnalyzerResultRequest request, CancellationToken ct = default)
    {
        var workflow = await RequireAsync(workflowId, ct);
        workflow.AnalyzerResultJson = JsonSerializer.Serialize(request);
        workflow.Status = WorkflowStatus.Validating;
        workflow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task RecordValidatorResultAsync(Guid workflowId, ValidatorResultRequest request, CancellationToken ct = default)
    {
        var workflow = await RequireAsync(workflowId, ct);
        workflow.ValidatorResultJson = JsonSerializer.Serialize(request);
        workflow.ApprovalRequired = request.RequiresHumanApproval;

        // Where we go next depends on skipMatcher, which the orchestrator
        // reads from PlanJson itself — this method only ever sets
        // PendingApproval (a stop) or Validating->next is decided by the
        // orchestrator's own logic after this call returns, not here.
        workflow.Status = request.RequiresHumanApproval
            ? WorkflowStatus.PendingApproval
            : WorkflowStatus.Matching;   // orchestrator advances past this to Finalizing if skipMatcher is true

        workflow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task RecordMatcherResultAsync(Guid workflowId, MatcherResultRequest request, CancellationToken ct = default)
    {
        var workflow = await RequireAsync(workflowId, ct);
        workflow.MatcherResultJson = JsonSerializer.Serialize(request);

        // Not auto-assigned (ambiguous, high-value, or already escalated) —
        // this reuses the same PendingApproval gate rather than a separate
        // status, since staff resolve it the same way: review, then proceed.
        workflow.Status = request.AutoAssign ? WorkflowStatus.Finalizing : WorkflowStatus.PendingApproval;
        if (!request.AutoAssign) workflow.ApprovalRequired = true;

        workflow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task RecordFinalizeAsync(Guid workflowId, FinalizeResultRequest request, Guid? resultingJobId, CancellationToken ct = default)
    {
        var workflow = await RequireAsync(workflowId, ct);
        workflow.FinalReasoningSummary = request.FinalReasoningSummary;
        workflow.ResultingJobId = resultingJobId;
        workflow.Status = request.ReadyForJobCreation ? WorkflowStatus.Completed : WorkflowStatus.Failed;
        workflow.CompletedAt = DateTime.UtcNow;
        workflow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task SetStatusAsync(Guid workflowId, WorkflowStatus status, CancellationToken ct = default)
    {
        var workflow = await RequireAsync(workflowId, ct);
        workflow.Status = status;
        workflow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<SubmissionSnapshotResponse?> GetSubmissionSnapshotAsync(Guid submissionId, CancellationToken ct = default)
    {
        var submission = await _db.Submissions
            .Include(s => s.Items)
            .FirstOrDefaultAsync(s => s.Id == submissionId, ct);

        if (submission is null) return null;

        return new SubmissionSnapshotResponse
        {
            SubmissionId = submission.Id,
            SubmissionType = submission.UserType,
            Description = string.Join(" | ", submission.Items.Select(i => i.Description).Where(d => !string.IsNullOrWhiteSpace(d))),
            ImageUrls = submission.Items.Select(i => i.ImageUrl).Where(u => !string.IsNullOrWhiteSpace(u)).ToList(),
            PickupAddress = submission.PickupAddress,
        };
    }

    public Task<BusinessRulesResponse> GetBusinessRulesAsync(CancellationToken ct = default)
    {
        // Read from appsettings rather than a table — lets an admin tune
        // thresholds by editing config (and restarting) without a migration.
        // A proper admin-editable table is a reasonable future enhancement;
        // this is the pragmatic choice for this slice.
        var section = _config.GetSection("WorkflowBusinessRules");
        var result = new BusinessRulesResponse
        {
            AutoHazardCeiling = section["AutoHazardCeiling"] ?? "Medium",
            MinConfidenceForAuto = double.TryParse(section["MinConfidenceForAuto"], out var conf) ? conf : 0.6,
            MaxValueForAutoUsd = decimal.TryParse(section["MaxValueForAutoUsd"], out var val) ? val : 500.0m,
        };
        return Task.FromResult(result);
    }

    public async Task<WorkflowApprovalAction> RecordApprovalActionAsync(
        Guid workflowId, WorkflowApprovalActionType actionType, Guid performedByUserId,
        string? comments, CancellationToken ct = default)
    {
        var action = new WorkflowApprovalAction
        {
            WorkflowId = workflowId,
            ActionType = actionType,
            PerformedByUserId = performedByUserId,
            Comments = comments,
        };
        _db.WorkflowApprovalActions.Add(action);
        await _db.SaveChangesAsync(ct);
        return action;
    }

    public async Task LogExecutionAsync(ExecutionLogRequest request, CancellationToken ct = default)
    {
        var log = new AgentExecutionLog
        {
            WorkflowId = request.WorkflowId,
            AgentName = request.AgentName,
            StepNumber = request.StepNumber,
            InputJson = JsonSerializer.Serialize(request.InputJson),
            OutputJson = request.OutputJson is null ? null : JsonSerializer.Serialize(request.OutputJson),
            Succeeded = request.Succeeded,
            ErrorMessage = request.ErrorMessage,
            CompletedAt = DateTime.UtcNow,
        };
        _db.AgentExecutionLogs.Add(log);
        await _db.SaveChangesAsync(ct);
    }

    public Task<List<AgentExecutionLog>> GetExecutionLogAsync(Guid workflowId, CancellationToken ct = default) =>
        _db.AgentExecutionLogs
            .AsNoTracking()
            .Where(l => l.WorkflowId == workflowId)
            .OrderBy(l => l.StepNumber).ThenBy(l => l.StartedAt)
            .ToListAsync(ct);

    private async Task<CollectionWorkflow> RequireAsync(Guid workflowId, CancellationToken ct)
    {
        return await _db.CollectionWorkflows.FirstOrDefaultAsync(w => w.WorkflowId == workflowId, ct)
            ?? throw new KeyNotFoundException($"Workflow {workflowId} not found.");
    }
}
