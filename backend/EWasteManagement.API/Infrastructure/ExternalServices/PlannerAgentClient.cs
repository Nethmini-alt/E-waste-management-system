using System.Net.Http.Json;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

public interface IPlannerAgentClient
{
    Task<PlanAgentResult> PlanAsync(Guid workflowId, Guid submissionId, CancellationToken ct = default);
    Task<FinalizeAgentResult> FinalizeAsync(Guid workflowId, object analyzerResult, object validatorResult, object? matcherResult, CancellationToken ct = default);
}

public class PlannerAgentClient : IPlannerAgentClient
{
    private readonly HttpClient _http;
    private readonly ILogger<PlannerAgentClient> _logger;

    public PlannerAgentClient(HttpClient http, IConfiguration config, ILogger<PlannerAgentClient> logger)
    {
        _http = http;
        _logger = logger;
        _http.BaseAddress = new Uri(config["Agent:PlannerBaseUrl"] ?? "http://localhost:8002");
        _http.Timeout = TimeSpan.FromSeconds(60);

        var apiKey = config["Agent:ApiKey"];
        if (!string.IsNullOrWhiteSpace(apiKey))
            _http.DefaultRequestHeaders.Add("X-Agent-Key", apiKey);
    }

    public async Task<PlanAgentResult> PlanAsync(Guid workflowId, Guid submissionId, CancellationToken ct = default)
    {
        var response = await _http.PostAsJsonAsync("/plan", new { workflowId, submissionId }, ct);
        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Planner /plan returned {Status}: {Body}", response.StatusCode, body);
            throw new InvalidOperationException($"Planner agent failed with status {(int)response.StatusCode}.");
        }
        return await response.Content.ReadFromJsonAsync<PlanAgentResult>(cancellationToken: ct)
            ?? throw new InvalidOperationException("Planner agent returned an empty response.");
    }

    public async Task<FinalizeAgentResult> FinalizeAsync(Guid workflowId, object analyzerResult, object validatorResult, object? matcherResult, CancellationToken ct = default)
    {
        var body = new { workflowId, analyzerResult, validatorResult, matcherResult };
        var response = await _http.PostAsJsonAsync("/finalize", body, ct);
        if (!response.IsSuccessStatusCode)
        {
            var respBody = await response.Content.ReadAsStringAsync(ct);
            _logger.LogError("Planner /finalize returned {Status}: {Body}", response.StatusCode, respBody);
            throw new InvalidOperationException($"Planner agent failed with status {(int)response.StatusCode}.");
        }
        return await response.Content.ReadFromJsonAsync<FinalizeAgentResult>(cancellationToken: ct)
            ?? throw new InvalidOperationException("Planner agent returned an empty response.");
    }
}

public class PlanAgentResult
{
    public Guid WorkflowId { get; set; }
    public List<PlanStepResult> Steps { get; set; } = new();
    public bool SkipMatcher { get; set; }
    public string Reasoning { get; set; } = string.Empty;
}

public class PlanStepResult
{
    public int StepNumber { get; set; }
    public string AgentName { get; set; } = string.Empty;
    public string Reason { get; set; } = string.Empty;
}

public class FinalizeAgentResult
{
    public Guid WorkflowId { get; set; }
    public string FinalReasoningSummary { get; set; } = string.Empty;
    public bool ReadyForJobCreation { get; set; }
}
