namespace EWasteManagement.API.Infrastructure.ExternalServices;

public class AgentRunGoal
{
    public Guid? TargetBuyerId { get; set; }
    public List<string>? TargetMaterialTypes { get; set; }
    public decimal? MaxQuantityKg { get; set; }
    public string? PreferredRoute { get; set; }   // "LocalSale" | "Export" | null
}

public interface IAgentClient
{
    Task<Guid> RunAgentAsync(AgentRunGoal? goal = null, CancellationToken ct = default);
}