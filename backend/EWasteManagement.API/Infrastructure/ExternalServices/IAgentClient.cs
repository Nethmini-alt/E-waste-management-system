namespace EWasteManagement.API.Infrastructure.ExternalServices;

public interface IAgentClient
{
    /// <summary>
    /// Trigger the Python Commercial Recovery Planning Agent to generate a plan.
    /// The agent will submit the resulting plan back to /api/commercial-plans
    /// itself, so this method returns the newly created plan id.
    /// </summary>
    Task<Guid> RunAgentAsync(CancellationToken ct = default);
}