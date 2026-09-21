using System.Net.Http.Json;
using System.Text.Json;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

public class AgenticAiClient : IAgenticAiClient
{
    private readonly HttpClient _http;
    private readonly IConfiguration _config;
    private readonly ILogger<AgenticAiClient> _logger;

    public AgenticAiClient(HttpClient http, IConfiguration config, ILogger<AgenticAiClient> logger)
    {
        _http = http;
        _config = config;
        _logger = logger;

        _http.BaseAddress = new Uri((config["Agent:BaseUrl"] ?? "http://localhost:8000").TrimEnd('/') + "/");
        _http.Timeout = TimeSpan.FromSeconds(10);   // the service only accepts the job here; the run itself is in the background
    }

    public Task<AgenticAiCallResult> StartWorkflowAsync(object payload, CancellationToken ct = default)
        => PostAsync("workflows", payload, ct);

    public Task<AgenticAiCallResult> ReviseWorkflowAsync(Guid workflowId, object payload, CancellationToken ct = default)
        => PostAsync($"workflows/{workflowId}/revise", payload, ct);

    private async Task<AgenticAiCallResult> PostAsync(string path, object payload, CancellationToken ct)
    {
        var apiKey = _config["Agent:ApiKey"];
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            _logger.LogWarning("Agent:ApiKey is not configured; the call to {Path} was not made.", path);
            return new AgenticAiCallResult(false, null, "Agent:ApiKey is not configured.");
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = JsonContent.Create(payload) };
            request.Headers.Add("X-Agent-Key", apiKey);

            using var response = await _http.SendAsync(request, ct);
            if (response.IsSuccessStatusCode)
                return AgenticAiCallResult.Ok();

            var message = await ReadDetailAsync(response, ct);
            _logger.LogError("Agent service answered {Status} to {Path}: {Message}", (int)response.StatusCode, path, message);
            return new AgenticAiCallResult(false, (int)response.StatusCode, message);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException)
        {
            _logger.LogError(ex, "Could not reach the agent service at {Path}.", path);
            return new AgenticAiCallResult(false, null, "The agent service could not be reached.");
        }
    }

    // FastAPI reports errors as {"detail": "..."}.
    private static async Task<string> ReadDetailAsync(HttpResponseMessage response, CancellationToken ct)
    {
        var body = await response.Content.ReadAsStringAsync(ct);
        try
        {
            using var doc = JsonDocument.Parse(body);
            if (doc.RootElement.ValueKind == JsonValueKind.Object
                && doc.RootElement.TryGetProperty("detail", out var detail)
                && detail.ValueKind == JsonValueKind.String)
                return detail.GetString()!;
        }
        catch (JsonException) { /* not JSON: fall through */ }

        // e.g. a 422 validation error, where "detail" is a list: show the start of it.
        if (!string.IsNullOrWhiteSpace(body))
            return body.Length > 300 ? body[..300] : body;

        return $"HTTP {(int)response.StatusCode}";
    }
}
