namespace EWasteManagement.API.Features.Workflow.DTOs;

// ---- Agent-facing (POST /api/agent/...) ----

public class PlanResultRequest
{
    public object PlanJson { get; set; } = new();
    public bool SkipMatcher { get; set; }
    public string Reasoning { get; set; } = string.Empty;
}

public class AnalyzerResultRequest
{
    public string WasteCategory { get; set; } = string.Empty;
    public string HazardLevel { get; set; } = string.Empty;
    public decimal EstimatedVolumeKg { get; set; }
    public decimal EstimatedValueUsd { get; set; }
    public double ConfidenceScore { get; set; }
}

public class ValidatorResultRequest
{
    public bool ApprovedForAutoAssignment { get; set; }
    public bool RequiresHumanApproval { get; set; }
    public List<string> Reasons { get; set; } = new();
}

public class MatcherResultRequest
{
    public object RankedCollectors { get; set; } = new();
    public Guid? RecommendedCollectorId { get; set; }
    public bool AutoAssign { get; set; }
    public bool Ambiguous { get; set; }
    public string Reasoning { get; set; } = string.Empty;
}

public class FinalizeResultRequest
{
    public string FinalReasoningSummary { get; set; } = string.Empty;
    public bool ReadyForJobCreation { get; set; }
}

public class ExecutionLogRequest
{
    public Guid WorkflowId { get; set; }
    public string AgentName { get; set; } = string.Empty;
    public int StepNumber { get; set; }
    public object InputJson { get; set; } = new();
    public object? OutputJson { get; set; }
    public bool Succeeded { get; set; }
    public string? ErrorMessage { get; set; }
}

public class BusinessRulesResponse
{
    public string AutoHazardCeiling { get; set; } = "Medium";
    public double MinConfidenceForAuto { get; set; } = 0.6;
    public decimal MaxValueForAutoUsd { get; set; } = 500.0m;
    public List<string> RequiredFields { get; set; } = new() { "wasteCategory", "hazardLevel" };
}

public class SubmissionSnapshotResponse
{
    public Guid SubmissionId { get; set; }
    public string SubmissionType { get; set; } = "Household";
    public string Description { get; set; } = string.Empty;
    public List<string> ImageUrls { get; set; } = new();
    public string PickupAddress { get; set; } = string.Empty;
}

// ---- Staff-facing (/api/workflows/...) ----

public class WorkflowResponse
{
    public Guid WorkflowId { get; set; }
    public Guid SubmissionId { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? PlanJson { get; set; }
    public string? AnalyzerResultJson { get; set; }
    public string? ValidatorResultJson { get; set; }
    public string? MatcherResultJson { get; set; }
    public string? FinalReasoningSummary { get; set; }
    public bool ApprovalRequired { get; set; }
    public Guid? ResultingJobId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class WorkflowApprovalDecisionRequest
{
    public string? Comments { get; set; }
}

public class ExecutionLogEntryResponse
{
    public Guid LogId { get; set; }
    public string AgentName { get; set; } = string.Empty;
    public int StepNumber { get; set; }
    public string InputJson { get; set; } = "{}";
    public string? OutputJson { get; set; }
    public DateTime StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public bool Succeeded { get; set; }
    public string? ErrorMessage { get; set; }
}
