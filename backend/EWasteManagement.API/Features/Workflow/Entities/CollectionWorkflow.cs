namespace EWasteManagement.API.Features.Workflow.Entities;

/// <summary>
/// The shared, persisted state of one run of the intake-and-collection-planning
/// workflow: Planner -> Analyzer -> Validator -> Matcher -> Planner (finalize).
///
/// Unlike Sales/CommercialPlan (a single final snapshot written once), this row
/// is written to multiple times across a run, because the chain can pause for
/// human approval between separate, disconnected HTTP calls to the four agent
/// services — the backend has to remember which step it's on.
/// </summary>
public class CollectionWorkflow
{
    public Guid WorkflowId { get; set; } = Guid.NewGuid();

    // Loose id, not an EF-enforced FK — Submission lives in a different feature's
    // namespace, and Job.cs already established the team's convention of not taking
    // a hard cross-feature dependency for ids like this. Still indexed below.
    public Guid SubmissionId { get; set; }

    public WorkflowStatus Status { get; set; } = WorkflowStatus.Planning;

    /// <summary>Planner's first-pass ordered step list, serialized as JSON.</summary>
    public string? PlanJson { get; set; }

    /// <summary>Analyzer's output: categories, weight, value, hazard, confidence.</summary>
    public string? AnalyzerResultJson { get; set; }

    /// <summary>Validator's output: approved / requires-approval + reasons.</summary>
    public string? ValidatorResultJson { get; set; }

    /// <summary>
    /// Matcher's output — the FULL ranked collector list, not just the top pick,
    /// so a collector rejection can move to the next candidate without calling
    /// the agent again.
    /// </summary>
    public string? MatcherResultJson { get; set; }

    /// <summary>Planner's second-pass merge of all three agents' outputs.</summary>
    public string? FinalReasoningSummary { get; set; }

    /// <summary>Set by Validator (or by Matcher's own ambiguous-match check).</summary>
    public bool ApprovalRequired { get; set; }

    // Loose id, same reasoning as SubmissionId above — set once Planner finalizes
    // and the Job is actually created.
    public Guid? ResultingJobId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }

    // Navigation
    public ICollection<WorkflowApprovalAction> ApprovalActions { get; set; } = new List<WorkflowApprovalAction>();
}

public enum WorkflowStatus
{
    Planning,
    Analyzing,
    Validating,
    PendingApproval,
    Matching,
    Finalizing,
    Completed,
    Rejected,
    Failed
}