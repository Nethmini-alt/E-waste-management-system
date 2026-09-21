namespace EWasteManagement.API.Infrastructure.ExternalServices;

/// <summary>Outcome of a call to the agentic-ai service. StatusCode is null when it could not be reached.</summary>
public record AgenticAiCallResult(bool Success, int? StatusCode, string? Message)
{
    public static AgenticAiCallResult Ok() => new(true, 202, null);
}

/// <summary>
/// The ASP.NET Core side of the agentic-ai service (POST /workflows, POST /workflows/{id}/revise).
/// Not to be confused with IAgentClient, the older client for the removed Sales "/run" endpoint.
/// </summary>
public interface IAgenticAiClient
{
    /// <summary>Starts a workflow. The service answers 202 straight away and reports its progress back later.</summary>
    Task<AgenticAiCallResult> StartWorkflowAsync(object payload, CancellationToken ct = default);

    /// <summary>Asks the service to re-run Validator -> Matcher -> Planner with staff feedback (409 = revision limit).</summary>
    Task<AgenticAiCallResult> ReviseWorkflowAsync(Guid workflowId, object payload, CancellationToken ct = default);
}
