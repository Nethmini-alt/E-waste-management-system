using System.Text.Json;
using EWasteManagement.Api.Entities;
using EWasteManagement.API.Features.AgentWorkflows.DTOs;
using EWasteManagement.API.Features.AgentWorkflows.Entities;
using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Services;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.AgentWorkflows.Services;

public interface IAgentWorkflowService
{
    // Agent-facing: the agent service reports what it did.
    Task RecordStepAsync(Guid workflowId, AgentStepReport report, CancellationToken ct = default);
    Task RecordResultAsync(Guid workflowId, AgentResultReport report, CancellationToken ct = default);

    // Staff-facing.
    Task<IReadOnlyList<AgentWorkflowResponse>> GetAllAsync(string? status, CancellationToken ct = default);
    Task<AgentWorkflowResponse> GetByIdAsync(Guid workflowId, CancellationToken ct = default);
    Task<AgentWorkflowResponse> ApproveAsync(Guid workflowId, Guid staffUserId, ApproveWorkflowRequest request, CancellationToken ct = default);
    Task<AgentWorkflowResponse> RejectAsync(Guid workflowId, Guid staffUserId, RejectWorkflowRequest request, CancellationToken ct = default);
    Task<AgentWorkflowResponse> ReviseAsync(Guid workflowId, Guid staffUserId, ReviseWorkflowRequest request, CancellationToken ct = default);
}

public class AgentWorkflowService : IAgentWorkflowService
{
    private static readonly string[] StepStatuses = { "succeeded", "failed", "skipped" };

    private readonly ApplicationDbContext _db;
    private readonly IJobService _jobs;
    private readonly IAgenticAiClient _agent;
    private readonly ILogger<AgentWorkflowService> _logger;

    public AgentWorkflowService(
        ApplicationDbContext db, IJobService jobs, IAgenticAiClient agent, ILogger<AgentWorkflowService> logger)
    {
        _db = db;
        _jobs = jobs;
        _agent = agent;
        _logger = logger;
    }

    // =====================================================================
    // Agent-facing
    // =====================================================================

    public async Task RecordStepAsync(Guid workflowId, AgentStepReport report, CancellationToken ct = default)
    {
        if (report.WorkflowId is { } bodyId && bodyId != workflowId)
            throw new ArgumentException("workflow_id in the body does not match the URL.");
        if (!StepStatuses.Contains(report.Status))
            throw new ArgumentException("status must be one of: succeeded, failed, skipped.");

        var revision = await _db.AgentWorkflows.AsNoTracking()
            .Where(w => w.Id == workflowId)
            .Select(w => (int?)w.RevisionCount)
            .FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException($"Workflow {workflowId} not found.");

        var startedAt = ToUtc(report.StartedAt);

        // The agent service retries reports, so this must be an upsert. A step is identified by who ran it and
        // when it started (see the unique index): a retry updates the row, a re-run after a revision adds one.
        var step = await _db.AgentSteps.FirstOrDefaultAsync(s =>
            s.WorkflowId == workflowId && s.Agent == report.Agent &&
            s.StepName == report.StepName && s.StartedAt == startedAt, ct);

        var isNew = step is null;
        if (step is null)
        {
            step = new AgentStep
            {
                WorkflowId = workflowId,
                Revision = revision,
                Agent = report.Agent,
                StepName = report.StepName,
                StartedAt = startedAt
            };
            _db.AgentSteps.Add(step);
        }

        step.Status = report.Status;
        step.DurationMs = report.DurationMs;
        step.Retries = report.Retries;
        step.Error = report.Error;
        step.InputSummary = Raw(report.InputSummary);
        step.Output = Raw(report.Output);
        step.Checks = Raw(report.Checks);
        step.ToolCalls = Raw(report.ToolCalls);

        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException) when (isNew)
        {
            // Two copies of the same report raced; the other one won the unique index. Nothing more to do.
            _db.Entry(step).State = EntityState.Detached;
            var landed = await _db.AgentSteps.AnyAsync(s =>
                s.WorkflowId == workflowId && s.Agent == report.Agent &&
                s.StepName == report.StepName && s.StartedAt == startedAt, ct);
            if (!landed) throw;
        }
    }

    public async Task RecordResultAsync(Guid workflowId, AgentResultReport report, CancellationToken ct = default)
    {
        var workflow = await _db.AgentWorkflows.FirstOrDefaultAsync(w => w.Id == workflowId, ct)
            ?? throw new KeyNotFoundException($"Workflow {workflowId} not found.");

        if (report.WorkflowId is { } bodyId && bodyId != workflowId)
            throw new ArgumentException("workflow_id in the body does not match the URL.");
        if (report.SubmissionId is { } submissionId && submissionId != workflow.SubmissionId)
            throw new ArgumentException("submission_id does not belong to this workflow.");
        if (report.Outcome is not ("PendingApproval" or "ReadyForAutoAssignment" or "SafeFailure"))
            throw new ArgumentException("outcome must be PendingApproval, ReadyForAutoAssignment or SafeFailure.");

        // Already settled (decided, or handed to staff): a retried or late report must not undo that.
        if (workflow.Status is AgentWorkflowStatus.Completed or AgentWorkflowStatus.Rejected
            or AgentWorkflowStatus.NeedsManualReview)
            return;

        // The result of an earlier run arriving after a revision was already requested.
        if (report.RevisionCount < workflow.RevisionCount)
            return;

        workflow.Outcome = report.Outcome;
        workflow.FailureReason = report.FailureReason;
        workflow.Plan = Raw(report.Plan);
        workflow.Analysis = Raw(report.Analysis);
        workflow.Validation = Raw(report.Validation);
        workflow.Match = Raw(report.Match);
        workflow.Proposal = Raw(report.Proposal);
        workflow.UpdatedAt = DateTime.UtcNow;

        var submission = await LoadSubmissionAsync(workflow, ct);
        await UpsertAiAnalysisAsync(workflow, report, ct);

        if (report.Outcome == "SafeFailure")
        {
            workflow.Status = AgentWorkflowStatus.NeedsManualReview;
            workflow.FailureReason ??= "The agents could not produce a safe plan.";
            submission.Status = "Needs_Review";
            await _db.SaveChangesAsync(ct);
            return;
        }

        // Both remaining outcomes are stored first as "pending approval", so the agents' work is durable
        // even if creating the job fails below.
        workflow.Status = AgentWorkflowStatus.PendingApproval;
        submission.Status = "Pending_Approval";
        await _db.SaveChangesAsync(ct);

        if (report.Outcome != "ReadyForAutoAssignment")
            return;

        // No human gate needed: accept the plan right away, exactly like an approval but decided by the system.
        try
        {
            await AcceptPlanAsync(workflow, "AutoApproved", decidedByUserId: null, comments: null, ct);
        }
        catch (PreferredCollectorUnavailableException ex)
        {
            workflow.Status = AgentWorkflowStatus.NeedsManualReview;
            workflow.FailureReason = ex.Message;
            workflow.UpdatedAt = DateTime.UtcNow;
            submission.Status = "Needs_Review";
            await _db.SaveChangesAsync(ct);
        }
    }

    // =====================================================================
    // Staff-facing
    // =====================================================================

    public async Task<IReadOnlyList<AgentWorkflowResponse>> GetAllAsync(string? status, CancellationToken ct = default)
    {
        var query = _db.AgentWorkflows.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(status))
        {
            if (!Enum.TryParse<AgentWorkflowStatus>(status, ignoreCase: true, out var parsed))
                throw new ArgumentException($"Unknown status '{status}'.");
            query = query.Where(w => w.Status == parsed);
        }

        var workflows = await query.OrderByDescending(w => w.CreatedAt).ToListAsync(ct);
        return workflows.Select(w => Map(w, detail: false)).ToList();
    }

    public async Task<AgentWorkflowResponse> GetByIdAsync(Guid workflowId, CancellationToken ct = default)
    {
        var workflow = await _db.AgentWorkflows.AsNoTracking()
            .Include(w => w.Steps)
            .FirstOrDefaultAsync(w => w.Id == workflowId, ct)
            ?? throw new KeyNotFoundException($"Workflow {workflowId} not found.");

        return Map(workflow, detail: true);
    }

    public async Task<AgentWorkflowResponse> ApproveAsync(
        Guid workflowId, Guid staffUserId, ApproveWorkflowRequest request, CancellationToken ct = default)
    {
        var workflow = await LoadPendingAsync(workflowId, ct);
        await AcceptPlanAsync(workflow, "Approved", staffUserId, request.Comments?.Trim(), ct);
        return await GetByIdAsync(workflowId, ct);
    }

    public async Task<AgentWorkflowResponse> RejectAsync(
        Guid workflowId, Guid staffUserId, RejectWorkflowRequest request, CancellationToken ct = default)
    {
        var workflow = await LoadPendingAsync(workflowId, ct);
        var submission = await LoadSubmissionAsync(workflow, ct);

        workflow.Status = AgentWorkflowStatus.Rejected;
        workflow.Decision = "Rejected";
        workflow.DecidedByUserId = staffUserId;
        workflow.DecisionComments = request.Reason.Trim();
        workflow.DecidedAt = DateTime.UtcNow;
        workflow.UpdatedAt = workflow.DecidedAt;
        submission.Status = "Rejected";

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(workflowId, ct);
    }

    public async Task<AgentWorkflowResponse> ReviseAsync(
        Guid workflowId, Guid staffUserId, ReviseWorkflowRequest request, CancellationToken ct = default)
    {
        var workflow = await LoadPendingAsync(workflowId, ct);

        var previousRevision = workflow.RevisionCount;
        var previousExcluded = ReadGuidList(workflow.ExcludedCollectorIds);
        var mergedExcluded = previousExcluded.Concat(request.ExcludeCollectorIds).Distinct().ToList();

        // The state the agent service would need if it restarted since the first run. Built before we change
        // anything, and describes the run being revised.
        var previousState = await BuildPreviousStateAsync(workflow, previousRevision, previousExcluded, ct);

        // Mark first, call second: the new result could otherwise arrive before this save and be lost.
        // Postgres' xmin token makes a double click fail here instead of starting two revisions.
        workflow.Status = AgentWorkflowStatus.RevisionInProgress;
        workflow.RevisionCount = previousRevision + 1;
        workflow.ExcludedCollectorIds = JsonSerializer.Serialize(mergedExcluded);
        workflow.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        var result = await _agent.ReviseWorkflowAsync(workflowId, new
        {
            feedback = new
            {
                excludeCollectorIds = request.ExcludeCollectorIds,
                preferredWindowStart = request.PreferredWindowStart,
                preferredWindowEnd = request.PreferredWindowEnd,
                notes = request.Notes
            },
            previousState
        }, ct);

        if (!result.Success)
        {
            // Undo, so the plan stays on the staff member's screen and they can try again.
            workflow.Status = AgentWorkflowStatus.PendingApproval;
            workflow.RevisionCount = previousRevision;
            workflow.ExcludedCollectorIds = previousExcluded.Count == 0 ? null : JsonSerializer.Serialize(previousExcluded);
            workflow.UpdatedAt = DateTime.UtcNow;
            await _db.SaveChangesAsync(ct);

            var message = result.Message ?? "The agent service refused the revision.";
            throw result.StatusCode == 409
                ? new WorkflowConflictException(message)     // e.g. the revision limit was reached
                : new AgentServiceUnavailableException(message);
        }

        _logger.LogInformation("Revision {Revision} of workflow {WorkflowId} requested by {UserId}.",
            workflow.RevisionCount, workflowId, staffUserId);
        return await GetByIdAsync(workflowId, ct);
    }

    // =====================================================================
    // Shared: accepting a plan (staff approval, or automatic)
    // =====================================================================

    /// <summary>
    /// Creates the Job from the plan and marks the workflow Completed, in one transaction: if the job cannot be
    /// created (e.g. the recommended collector is gone) nothing is saved. If another staff member decided the same
    /// plan at the same moment, Postgres' concurrency token makes the second save fail and this rolls back.
    /// </summary>
    private async Task AcceptPlanAsync(
        AgentWorkflow workflow, string decision, Guid? decidedByUserId, string? comments, CancellationToken ct)
    {
        var submission = await LoadSubmissionAsync(workflow, ct);
        var facts = ReadPlanFacts(workflow);

        await using var transaction = await _db.Database.BeginTransactionAsync(ct);

        var job = await _jobs.CreateAndAssignAsync(new CreateJobDto
        {
            SubmissionId = submission.Id,
            PickupAddress = submission.PickupAddress,
            RequiredCapacityKg = facts.VolumeKg,
            ScheduledWindowStart = facts.WindowStart,
            ScheduledWindowEnd = facts.WindowEnd,
            PreferredCollectorId = facts.RecommendedCollectorId,
            PickupLatitude = facts.Latitude,
            PickupLongitude = facts.Longitude
        });

        workflow.JobId = job.JobId;
        workflow.Status = AgentWorkflowStatus.Completed;
        workflow.Decision = decision;
        workflow.DecidedByUserId = decidedByUserId;
        workflow.DecisionComments = comments;
        workflow.DecidedAt = DateTime.UtcNow;
        workflow.UpdatedAt = workflow.DecidedAt;
        submission.Status = "Approved";

        await _db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }

    // =====================================================================
    // Helpers
    // =====================================================================

    private async Task<AgentWorkflow> LoadPendingAsync(Guid workflowId, CancellationToken ct)
    {
        var workflow = await _db.AgentWorkflows.FirstOrDefaultAsync(w => w.Id == workflowId, ct)
            ?? throw new KeyNotFoundException($"Workflow {workflowId} not found.");

        if (workflow.Status != AgentWorkflowStatus.PendingApproval)
            throw new WorkflowConflictException(
                $"Workflow is '{workflow.Status}'; only a workflow that is pending approval can be decided.");

        return workflow;
    }

    /// <summary>
    /// Keeps the submission's AI analysis summary (the table the submit and admin-review pages read) in step with
    /// what the Analyzer reported. Skipped when the Analyzer did not get far enough to produce all the fields.
    /// Saved together with the caller's changes.
    /// </summary>
    private async Task UpsertAiAnalysisAsync(AgentWorkflow workflow, AgentResultReport report, CancellationToken ct)
    {
        var analysis = report.Analysis;
        var categories = GetStrings(analysis, "waste_categories");
        var hazard = GetString(analysis, "hazard_level");
        var volume = GetDecimal(analysis, "estimated_volume_kg");
        var value = GetDecimal(analysis, "estimated_value_lkr");
        if (categories.Count == 0 || hazard is null || volume is null || value is null)
            return;

        // The plan's own verdict when there is one; otherwise anything short of auto-assignment needs a person.
        var requiresApproval = GetBool(report.Proposal, "approval_required")
                               ?? report.Outcome != "ReadyForAutoAssignment";

        var row = await _db.AIAnalysisResults.FirstOrDefaultAsync(a => a.SubmissionId == workflow.SubmissionId, ct);
        if (row is null)
        {
            row = new AIAnalysisResult { SubmissionId = workflow.SubmissionId };   // AnalyzedAt = now (analysis is not re-run on a revision)
            _db.AIAnalysisResults.Add(row);
        }

        row.WasteCategory = string.Join(", ", categories);
        row.HazardLevel = hazard;
        row.EstimatedVolumeKg = volume.Value;
        row.EstimatedValueLkr = value.Value;
        row.RequiresHumanApproval = requiresApproval;
    }

    private async Task<Submission> LoadSubmissionAsync(AgentWorkflow workflow, CancellationToken ct)
        => await _db.Submissions.FirstOrDefaultAsync(s => s.Id == workflow.SubmissionId, ct)
           ?? throw new KeyNotFoundException($"Submission {workflow.SubmissionId} not found.");

    private async Task<Dictionary<string, object?>> BuildPreviousStateAsync(
        AgentWorkflow workflow, int revisionCount, List<Guid> excluded, CancellationToken ct)
    {
        var submission = await LoadSubmissionAsync(workflow, ct);
        var items = await _db.SubmissionItems.AsNoTracking()
            .Where(i => i.SubmissionId == workflow.SubmissionId).ToListAsync(ct);

        // Same text the agent screens at the start: "<name>: <description>" for every item.
        var description = string.Join("\n", items
            .Select(i => $"{i.ItemName}: {i.Description}".Trim(':', ' ').Trim())
            .Where(t => t.Length > 0));

        // Keys are snake_case because that is what the agent service reads from its own saved state.
        return new Dictionary<string, object?>
        {
            ["workflow_id"] = workflow.WorkflowId,
            ["submission_id"] = workflow.SubmissionId,
            ["submission_type"] = AgentPayloads.SubmissionType(submission.UserType),
            ["pickup_address"] = submission.PickupAddress,
            ["description"] = description.Length > 8000 ? description[..8000] : description,
            ["items"] = items.Select(i => new
            {
                item_name = i.ItemName,
                description = i.Description ?? string.Empty,
                image_url = string.IsNullOrWhiteSpace(i.ImageUrl) ? null : i.ImageUrl
            }).ToList(),
            ["csv_items"] = Array.Empty<object>(),
            ["plan"] = ParseJson(workflow.Plan),
            ["analysis"] = ParseJson(workflow.Analysis),
            ["revision_count"] = revisionCount,
            ["exclude_collector_ids"] = excluded
        };
    }

    private sealed record PlanFacts(
        Guid? RecommendedCollectorId, DateTime? WindowStart, DateTime? WindowEnd,
        decimal? VolumeKg, decimal? Latitude, decimal? Longitude);

    /// <summary>Reads what the Job needs out of the agents' stored JSON. Every field is optional.</summary>
    private static PlanFacts ReadPlanFacts(AgentWorkflow workflow)
    {
        var proposal = ParseJson(workflow.Proposal);
        var analysis = ParseJson(workflow.Analysis);
        var match = ParseJson(workflow.Match);

        return new PlanFacts(
            RecommendedCollectorId: GetGuid(proposal, "recommended_collector_id"),
            WindowStart: GetDateTime(proposal, "pickup_window_start"),
            WindowEnd: GetDateTime(proposal, "pickup_window_end"),
            VolumeKg: GetDecimal(analysis, "estimated_volume_kg"),
            Latitude: GetDecimal(match, "pickup_latitude"),
            Longitude: GetDecimal(match, "pickup_longitude"));
    }

    private static JsonElement? Prop(JsonElement? obj, string name)
        => obj is { ValueKind: JsonValueKind.Object } o
           && o.TryGetProperty(name, out var value)
           && value.ValueKind != JsonValueKind.Null
            ? value
            : null;

    private static Guid? GetGuid(JsonElement? obj, string name)
        => Prop(obj, name) is { ValueKind: JsonValueKind.String } v && v.TryGetGuid(out var g) ? g : null;

    private static DateTime? GetDateTime(JsonElement? obj, string name)
        => Prop(obj, name) is { ValueKind: JsonValueKind.String } v && v.TryGetDateTime(out var d) ? ToUtc(d) : null;

    private static decimal? GetDecimal(JsonElement? obj, string name)
        => Prop(obj, name) is { ValueKind: JsonValueKind.Number } v && v.TryGetDecimal(out var d) ? d : null;

    private static string? GetString(JsonElement? obj, string name)
        => Prop(obj, name) is { ValueKind: JsonValueKind.String } v && !string.IsNullOrWhiteSpace(v.GetString())
            ? v.GetString()
            : null;

    private static bool? GetBool(JsonElement? obj, string name)
        => Prop(obj, name) is { } v && v.ValueKind is JsonValueKind.True or JsonValueKind.False
            ? v.GetBoolean()
            : null;

    private static List<string> GetStrings(JsonElement? obj, string name)
        => Prop(obj, name) is { ValueKind: JsonValueKind.Array } v
            ? v.EnumerateArray()
                .Where(e => e.ValueKind == JsonValueKind.String && !string.IsNullOrWhiteSpace(e.GetString()))
                .Select(e => e.GetString()!.Trim())
                .ToList()
            : new List<string>();

    private static List<Guid> ReadGuidList(string? json)
        => string.IsNullOrWhiteSpace(json)
            ? new List<Guid>()
            : JsonSerializer.Deserialize<List<Guid>>(json) ?? new List<Guid>();

    private static JsonElement? ParseJson(string? json)
        => string.IsNullOrWhiteSpace(json) ? null : JsonSerializer.Deserialize<JsonElement>(json);

    private static string? Raw(JsonElement? element)
        => element is { ValueKind: not (JsonValueKind.Null or JsonValueKind.Undefined) } e ? e.GetRawText() : null;

    private static DateTime ToUtc(DateTime value)
        => value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc)
            : value.ToUniversalTime();

    private static AgentWorkflowResponse Map(AgentWorkflow w, bool detail) => new()
    {
        WorkflowId = w.WorkflowId,
        SubmissionId = w.SubmissionId,
        Status = w.Status.ToString(),
        Outcome = w.Outcome,
        FailureReason = w.FailureReason,
        RevisionCount = w.RevisionCount,
        Proposal = ParseJson(w.Proposal),
        Analysis = ParseJson(w.Analysis),
        Plan = detail ? ParseJson(w.Plan) : null,
        Validation = detail ? ParseJson(w.Validation) : null,
        Match = detail ? ParseJson(w.Match) : null,
        Steps = detail
            ? w.Steps.OrderBy(s => s.StartedAt).Select(s => new AgentStepResponse
            {
                Id = s.Id,
                Revision = s.Revision,
                Agent = s.Agent,
                StepName = s.StepName,
                Status = s.Status,
                StartedAt = s.StartedAt,
                DurationMs = s.DurationMs,
                Retries = s.Retries,
                Error = s.Error,
                InputSummary = ParseJson(s.InputSummary),
                Output = ParseJson(s.Output),
                Checks = ParseJson(s.Checks),
                ToolCalls = ParseJson(s.ToolCalls)
            }).ToList()
            : null,
        JobId = w.JobId,
        Decision = w.Decision,
        DecidedByUserId = w.DecidedByUserId,
        DecisionComments = w.DecisionComments,
        DecidedAt = w.DecidedAt,
        CreatedAt = w.CreatedAt,
        UpdatedAt = w.UpdatedAt
    };
}
