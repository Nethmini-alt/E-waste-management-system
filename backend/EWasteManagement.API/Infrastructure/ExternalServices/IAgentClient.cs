namespace EWasteManagement.API.Infrastructure.ExternalServices;

public class AgentRunGoal
{
    public Guid? TargetBuyerId { get; set; }
    public List<string>? TargetMaterialTypes { get; set; }
    public decimal? MaxQuantityKg { get; set; }
    public string? PreferredRoute { get; set; }   // "LocalSale" | "Export" | null
}

/// <summary>One open material request the agent must weigh against its competitors.</summary>
public class DemandPriorityCandidate
{
    public Guid MaterialRequestId { get; set; }
    public Guid BuyerId { get; set; }
    public string BuyerType { get; set; } = string.Empty;   // "Local" | "Export"
    public decimal QuantityKg { get; set; }
    public decimal? PricePerKg { get; set; }
    public DateTime CreatedAt { get; set; }
    public double WaitingHours { get; set; }
}

/// <summary>
/// "Given this stock and these competing requests, who do we serve first?" — answered by
/// the Sales agent's priority tools (agentic-ai/Sales/graph/priority.py) instead of by a
/// net-value ORDER BY in the backend.
/// </summary>
public class DemandPriorityGoal
{
    public string MaterialType { get; set; } = string.Empty;
    public decimal? CapacityKg { get; set; }
    public List<DemandPriorityCandidate> Candidates { get; set; } = new();
}

public class DemandPriorityResult
{
    public string Strategy { get; set; } = string.Empty;
    public string StrategyReason { get; set; } = string.Empty;
    public string ReasoningSummary { get; set; } = string.Empty;
    public List<Guid> RankedMaterialRequestIds { get; set; } = new();
}

public interface IAgentClient
{
    Task<Guid> RunAgentAsync(AgentRunGoal? goal = null, CancellationToken ct = default);

    /// <summary>
    /// Asks the Sales agent to rank competing demand. Returns null when the agent has no
    /// opinion (or can't be reached), in which case the caller keeps its own deterministic
    /// ordering — stock allocation must not stall on a Python service being down.
    /// </summary>
    Task<DemandPriorityResult?> PrioritizeDemandAsync(
        DemandPriorityGoal goal, CancellationToken ct = default);
}