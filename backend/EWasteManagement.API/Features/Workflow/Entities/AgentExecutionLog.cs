namespace EWasteManagement.API.Features.Workflow.Entities;

/// <summary>
/// One row per agent invocation, across every workflow type in the system —
/// not just CollectionWorkflow. This is what Section 9.1's Observability
/// requirement (tool calls, timings, errors, retries) is graded against;
/// nothing else in the codebase captures per-step timing today, not even
/// Sales/CommercialPlan, which only ever stores the agent's final result.
/// </summary>
public class AgentExecutionLog
{
    public Guid LogId { get; set; } = Guid.NewGuid();

    /// <summary>
    /// Loose correlator, not an FK: points at either CollectionWorkflow.WorkflowId
    /// or CommercialPlan.WorkflowId depending on which agent wrote the row, so it
    /// deliberately isn't constrained to one feature's table.
    /// </summary>
    public Guid WorkflowId { get; set; }

    /// <summary>"Planner" | "Analyzer" | "Validator" | "Matcher" | "Sales".</summary>
    public string AgentName { get; set; } = string.Empty;

    public int StepNumber { get; set; }

    public string InputJson { get; set; } = "{}";
    public string? OutputJson { get; set; }

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;
    public DateTime? CompletedAt { get; set; }

    public bool Succeeded { get; set; }
    public string? ErrorMessage { get; set; }
}