using System.Net.Http.Json;
using EWasteManagement.API.Features.Sales.DTOs;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

public class AgentClient : IAgentClient
{
    private readonly HttpClient _http;
    private readonly ILogger<AgentClient> _logger;

    public AgentClient(HttpClient http, IConfiguration config, ILogger<AgentClient> logger)
    {
        _http = http;
        _logger = logger;

        _http.BaseAddress = new Uri(config["Agent:BaseUrl"] ?? "http://localhost:8001");
        _http.Timeout = TimeSpan.FromMinutes(3);  // workflows can take a while

        var apiKey = config["Agent:ApiKey"];
        if (!string.IsNullOrWhiteSpace(apiKey))
            _http.DefaultRequestHeaders.Add("X-Agent-Key", apiKey);
    }

    public async Task<Guid> RunAgentAsync(AgentRunGoal? goal = null, CancellationToken ct = default)
{
    _logger.LogInformation("Triggering Python agent at {Base}", _http.BaseAddress);

    // Use your DTO instead of anonymous types
    var body = goal is null ? new GenerateCommercialPlanRequest() : new GenerateCommercialPlanRequest
    {
        TargetBuyerId = goal.TargetBuyerId,
        TargetMaterialTypes = goal.TargetMaterialTypes,
        MaxQuantityKg = goal.MaxQuantityKg,
        PreferredRoute = goal.PreferredRoute,
    };

    var response = await _http.PostAsJsonAsync("/run", body, ct);

    if (!response.IsSuccessStatusCode)
    {
        var respBody = await response.Content.ReadAsStringAsync(ct);
        _logger.LogError("Agent returned {Status}: {Body}", response.StatusCode, respBody);
        throw new InvalidOperationException(
            $"Agent service failed with status {(int)response.StatusCode}.");
    }

    var result = await response.Content.ReadFromJsonAsync<AgentRunResult>(cancellationToken: ct)
        ?? throw new InvalidOperationException("Agent returned an empty response.");

    return result.CommercialPlanId;
}

public async Task<DemandPriorityResult?> PrioritizeDemandAsync(
    DemandPriorityGoal goal, CancellationToken ct = default)
{
    // No `objective` field on purpose: the agent owns the policy. Its model picks one
    // when a key is configured and falls back to net value — today's backend behaviour —
    // when it isn't, so this call is safe to make on every matching cycle.
    var body = new
    {
        materialType = goal.MaterialType,
        capacityKg = goal.CapacityKg,
        candidates = goal.Candidates.Select(candidate => new
        {
            materialRequestId = candidate.MaterialRequestId,
            buyerId = candidate.BuyerId,
            buyerType = candidate.BuyerType,
            quantityKg = candidate.QuantityKg,
            pricePerKg = candidate.PricePerKg,
            createdAt = candidate.CreatedAt,
            waitingHours = candidate.WaitingHours
        })
    };

    using var response = await _http.PostAsJsonAsync("/prioritize-demand", body, ct);
    if (!response.IsSuccessStatusCode)
    {
        var detail = await response.Content.ReadAsStringAsync(ct);
        _logger.LogWarning("Prioritise-demand returned {Status}: {Body}", response.StatusCode, detail);
        return null;
    }

    var payload = await response.Content.ReadFromJsonAsync<PriorityDemandResponse>(cancellationToken: ct);
    if (payload?.Ranked is null || payload.Ranked.Count == 0)
        return null;   // no opinion → the caller keeps its own deterministic ordering

    return new DemandPriorityResult
    {
        Strategy = payload.Strategy,
        StrategyReason = payload.StrategyReason,
        ReasoningSummary = payload.ReasoningSummary,
        RankedMaterialRequestIds = payload.Ranked
            .OrderBy(item => item.PriorityRank)
            .Select(item => item.MaterialRequestId)
            .ToList()
    };
}


    // Matches the JSON shape from AgentRunResponse in Python (camelCase)
    private class AgentRunResult
    {
        public Guid WorkflowId { get; set; }
        public Guid CommercialPlanId { get; set; }
        public string RecommendedRoute { get; set; } = string.Empty;
        public decimal ExpectedRevenue { get; set; }
        public decimal EstimatedNetValue { get; set; }
        public bool ApprovalRequired { get; set; }
        public string ReasoningSummary { get; set; } = string.Empty;
        public List<string> RiskFlags { get; set; } = new();
    }

    // Matches PrioritizeDemandResponse in Python (camelCase). Fields the backend has no
    // use for (factors, routeScores, …) are simply not mapped.
    private class PriorityDemandResponse
    {
        public string Strategy { get; set; } = string.Empty;
        public string StrategyReason { get; set; } = string.Empty;
        public string ReasoningSummary { get; set; } = string.Empty;
        public List<PriorityDemandItem> Ranked { get; set; } = new();
    }

    private class PriorityDemandItem
    {
        public Guid MaterialRequestId { get; set; }
        public int PriorityRank { get; set; }
        public bool Feasible { get; set; }
    }
}