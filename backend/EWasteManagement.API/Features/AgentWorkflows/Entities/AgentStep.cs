namespace EWasteManagement.API.Features.AgentWorkflows.Entities;

/// <summary>One finished agent step, reported by the agent service (the "what did the agents do" trail).</summary>
public class AgentStep
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid WorkflowId { get; set; }
    public AgentWorkflow? Workflow { get; set; }

    /// <summary>Which run of the workflow this step belongs to (0 = first run, 1 = after the first revision...).</summary>
    public int Revision { get; set; }

    /// <summary>analyzer | validator | matcher | planner | orchestrator.</summary>
    public string Agent { get; set; } = string.Empty;
    public string StepName { get; set; } = string.Empty;

    /// <summary>succeeded | failed | skipped.</summary>
    public string Status { get; set; } = string.Empty;

    public DateTime StartedAt { get; set; }
    public int DurationMs { get; set; }
    public int Retries { get; set; }
    public string? Error { get; set; }

    // Raw JSON as reported (jsonb columns). Personal data is already redacted by the agent service.
    public string? InputSummary { get; set; }
    public string? Output { get; set; }
    public string? Checks { get; set; }
    public string? ToolCalls { get; set; }
}
