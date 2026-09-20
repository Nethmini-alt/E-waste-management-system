using System.Net.Http.Json;

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

    public async Task<Guid> RunAgentAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("Triggering Python agent at {Base}", _http.BaseAddress);

        var response = await _http.PostAsJsonAsync("/run", new { }, ct);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Agent returned {Status}: {Body}", response.StatusCode, body);
            throw new InvalidOperationException(
                $"Agent service failed with status {(int)response.StatusCode}.");
        }

        var result = await response.Content.ReadFromJsonAsync<AgentRunResult>(cancellationToken: ct)
            ?? throw new InvalidOperationException("Agent returned an empty response.");

        return result.CommercialPlanId;
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
}