using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EWasteManagement.API.Features.AgentWorkflows.DTOs;

// What the Python agent service POSTs to /api/agent/workflows/{id}/steps and /result.
// Its JSON is snake_case, so every property carries an explicit name (the rest of the API is camelCase).
// The nested objects (input_summary, plan, analysis...) are kept as raw JSON and stored as-is.

public class AgentStepReport
{
    [JsonPropertyName("workflow_id")]
    public Guid? WorkflowId { get; set; }

    [JsonPropertyName("agent"), Required, StringLength(30)]
    public string Agent { get; set; } = string.Empty;

    [JsonPropertyName("step_name"), Required, StringLength(60)]
    public string StepName { get; set; } = string.Empty;

    /// <summary>succeeded | failed | skipped.</summary>
    [JsonPropertyName("status"), Required]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("started_at")]
    public DateTime StartedAt { get; set; }

    [JsonPropertyName("duration_ms"), Range(0, int.MaxValue)]
    public int DurationMs { get; set; }

    [JsonPropertyName("retries"), Range(0, 1000)]
    public int Retries { get; set; }

    [JsonPropertyName("error"), StringLength(1000)]
    public string? Error { get; set; }

    [JsonPropertyName("input_summary")]
    public JsonElement? InputSummary { get; set; }

    [JsonPropertyName("output")]
    public JsonElement? Output { get; set; }

    [JsonPropertyName("checks")]
    public JsonElement? Checks { get; set; }

    [JsonPropertyName("tool_calls")]
    public JsonElement? ToolCalls { get; set; }
}

public class AgentResultReport
{
    [JsonPropertyName("workflow_id")]
    public Guid? WorkflowId { get; set; }

    [JsonPropertyName("submission_id")]
    public Guid? SubmissionId { get; set; }

    /// <summary>PendingApproval | ReadyForAutoAssignment | SafeFailure.</summary>
    [JsonPropertyName("outcome"), Required]
    public string Outcome { get; set; } = string.Empty;

    [JsonPropertyName("failure_reason"), StringLength(1000)]
    public string? FailureReason { get; set; }

    [JsonPropertyName("revision_count"), Range(0, 1000)]
    public int RevisionCount { get; set; }

    [JsonPropertyName("plan")]
    public JsonElement? Plan { get; set; }

    [JsonPropertyName("analysis")]
    public JsonElement? Analysis { get; set; }

    [JsonPropertyName("validation")]
    public JsonElement? Validation { get; set; }

    [JsonPropertyName("match")]
    public JsonElement? Match { get; set; }

    [JsonPropertyName("proposal")]
    public JsonElement? Proposal { get; set; }
}
