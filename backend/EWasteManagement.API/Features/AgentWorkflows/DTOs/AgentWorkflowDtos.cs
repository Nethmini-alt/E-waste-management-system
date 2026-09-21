using System.ComponentModel.DataAnnotations;
using System.Text.Json;

namespace EWasteManagement.API.Features.AgentWorkflows.DTOs;

// ---------- Staff/Admin-facing (React) ----------

public class AgentWorkflowResponse
{
    public Guid WorkflowId { get; set; }
    public Guid SubmissionId { get; set; }

    /// <summary>Planning | PendingApproval | RevisionInProgress | Completed | Rejected | NeedsManualReview.</summary>
    public string Status { get; set; } = string.Empty;
    public string? Outcome { get; set; }
    public string? FailureReason { get; set; }
    public int RevisionCount { get; set; }

    // The agents' own JSON, passed through untouched (so its inner field names are snake_case).
    public JsonElement? Proposal { get; set; }
    public JsonElement? Analysis { get; set; }

    // Only filled in on the single-workflow endpoint.
    public JsonElement? Plan { get; set; }
    public JsonElement? Validation { get; set; }
    public JsonElement? Match { get; set; }
    public List<AgentStepResponse>? Steps { get; set; }

    public Guid? JobId { get; set; }
    public string? Decision { get; set; }
    public Guid? DecidedByUserId { get; set; }
    public string? DecisionComments { get; set; }
    public DateTime? DecidedAt { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

public class AgentStepResponse
{
    public Guid Id { get; set; }
    public int Revision { get; set; }
    public string Agent { get; set; } = string.Empty;
    public string StepName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public DateTime StartedAt { get; set; }
    public int DurationMs { get; set; }
    public int Retries { get; set; }
    public string? Error { get; set; }
    public JsonElement? InputSummary { get; set; }
    public JsonElement? Output { get; set; }
    public JsonElement? Checks { get; set; }
    public JsonElement? ToolCalls { get; set; }
}

public class ApproveWorkflowRequest
{
    [StringLength(1000)]
    public string? Comments { get; set; }
}

public class RejectWorkflowRequest
{
    /// <summary>Why the plan was rejected. Required: it is what the generator is told.</summary>
    [Required, StringLength(1000, MinimumLength = 3)]
    public string Reason { get; set; } = string.Empty;
}

/// <summary>
/// Feedback for a revision. The agents re-run the Validator, Matcher and Planner with it.
/// Either an excluded collector or a preferred window must be given, otherwise the re-run would produce the same plan.
/// </summary>
public class ReviseWorkflowRequest : IValidatableObject
{
    /// <summary>Collectors the Matcher must skip (e.g. staff know one is unavailable).</summary>
    public List<Guid> ExcludeCollectorIds { get; set; } = new();

    public DateTime? PreferredWindowStart { get; set; }
    public DateTime? PreferredWindowEnd { get; set; }

    /// <summary>Staff note for the audit trail only; it is never shown to a language model.</summary>
    [StringLength(500)]
    public string? Notes { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (PreferredWindowStart.HasValue != PreferredWindowEnd.HasValue)
            yield return new ValidationResult(
                "Give both PreferredWindowStart and PreferredWindowEnd, or neither.",
                new[] { nameof(PreferredWindowStart), nameof(PreferredWindowEnd) });

        if (PreferredWindowStart.HasValue && PreferredWindowEnd.HasValue && PreferredWindowEnd <= PreferredWindowStart)
            yield return new ValidationResult(
                "PreferredWindowEnd must be after PreferredWindowStart.", new[] { nameof(PreferredWindowEnd) });

        if (ExcludeCollectorIds.Count > 50)
            yield return new ValidationResult("At most 50 collectors can be excluded.", new[] { nameof(ExcludeCollectorIds) });

        // Notes are audit-only, so on their own they would not change the re-run's result.
        if (ExcludeCollectorIds.Count == 0 && !PreferredWindowStart.HasValue)
            yield return new ValidationResult(
                "A revision needs feedback that changes the plan: exclude a collector or give a preferred window.");
    }
}
