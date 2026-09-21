using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.AgentWorkflows.Entities;

// IMPORTANT: Only append new statuses at the end of this list. Stored as a lowercase string
// (see AgentWorkflowConfiguration), like JobStatus.
public enum AgentWorkflowStatus
{
    /// <summary>Row created, the agents are (or should be) running.</summary>
    Planning,
    /// <summary>The agents finished; a staff member must approve, reject or request a revision.</summary>
    PendingApproval,
    /// <summary>Staff asked for a revision; the agents are re-running Validator -> Matcher -> Planner.</summary>
    RevisionInProgress,
    /// <summary>Plan accepted (by staff or automatically) and the Job was created.</summary>
    Completed,
    /// <summary>Staff rejected the plan.</summary>
    Rejected,
    /// <summary>The agents failed safely (or the job could not be created); staff must handle it manually.</summary>
    NeedsManualReview
}

/// <summary>
/// One agent run for one submission. The Python service owns the reasoning; this row is the durable
/// record React and Flutter read. Id is the workflow id the agent service echoes back.
/// Extends BaseEntity so Postgres' xmin token stops two staff members deciding the same plan at once.
/// </summary>
public class AgentWorkflow : BaseEntity
{
    /// <summary>Same value as Id; named the way the agent service and the API contract call it.</summary>
    public Guid WorkflowId => Id;

    public Guid SubmissionId { get; set; }

    public AgentWorkflowStatus Status { get; set; } = AgentWorkflowStatus.Planning;

    /// <summary>What the agents reported: PendingApproval | ReadyForAutoAssignment | SafeFailure.</summary>
    public string? Outcome { get; set; }
    public string? FailureReason { get; set; }

    /// <summary>Revisions requested so far (the agent service caps this).</summary>
    public int RevisionCount { get; set; }

    // Raw JSON exactly as the agents reported it (jsonb columns).
    public string? Plan { get; set; }
    public string? Analysis { get; set; }
    public string? Validation { get; set; }
    public string? Match { get; set; }
    public string? Proposal { get; set; }

    /// <summary>JSON array of collector ids staff asked the Matcher to skip, accumulated over revisions.</summary>
    public string? ExcludedCollectorIds { get; set; }

    /// <summary>The Job created when the plan was accepted.</summary>
    public Guid? JobId { get; set; }

    /// <summary>Approved | AutoApproved | Rejected.</summary>
    public string? Decision { get; set; }
    /// <summary>Null when the system decided (AutoApproved).</summary>
    public Guid? DecidedByUserId { get; set; }
    public string? DecisionComments { get; set; }
    public DateTime? DecidedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public List<AgentStep> Steps { get; set; } = new();
}
