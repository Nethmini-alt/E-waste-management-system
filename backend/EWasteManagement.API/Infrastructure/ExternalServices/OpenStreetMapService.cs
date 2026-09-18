using System.Text.Json;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

public class OpenStreetMapService : IGeoService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<OpenStreetMapService> _logger;
    private readonly string _nominatimBaseUrl;
    private readonly string _osrmBaseUrl;
    private readonly string _userAgent;

    public OpenStreetMapService(HttpClient httpClient, IConfiguration configuration, ILogger<OpenStreetMapService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        // Public demo servers by default — no API key, no billing. Swappable
        // via config later if you self-host OSRM or use a different Nominatim
        // instance (e.g. for reliability beyond a student project).
        _nominatimBaseUrl = configuration["OpenStreetMap:NominatimBaseUrl"] ?? "https://nominatim.openstreetmap.org";
        _osrmBaseUrl = configuration["OpenStreetMap:OsrmBaseUrl"] ?? "https://router.project-osrm.org";

        var contactEmail = configuration["OpenStreetMap:ContactEmail"] ?? "student-project@example.com";
        _userAgent = $"EWasteManagementSystem-StudentProject/1.0 ({contactEmail})";
    }

    public async Task<(decimal Latitude, decimal Longitude)?> GeocodeAsync(string address)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            _logger.LogWarning("GeocodeAsync called with an empty address.");
            return null;
        }

        var url = $"{_nominatimBaseUrl}/search?q={Uri.EscapeDataString(address)}&format=json&limit=1";

        try
        {
            using var requestMessage = new HttpRequestMessage(HttpMethod.Get, url);

            // Nominatim's usage policy requires a real, identifying User-Agent —
            // requests without one get blocked outright.
            requestMessage.Headers.UserAgent.ParseAdd(_userAgent);

            var response = await _httpClient.SendAsync(requestMessage);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Nominatim call failed with status {StatusCode} for address '{Address}'.",
                    response.StatusCode, address);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync();
            var results = JsonSerializer.Deserialize<List<NominatimResult>>(body);

            if (results is null || results.Count == 0)
            {
                _logger.LogInformation("Nominatim found no match for address '{Address}'.", address);
                return null;
            }

            var first = results[0];
            if (!decimal.TryParse(first.Lat, out var lat) || !decimal.TryParse(first.Lon, out var lon))
            {
                _logger.LogWarning("Nominatim returned unparseable coordinates for address '{Address}'.", address);
                return null;
            }

            return (lat, lon);
        }
        catch (Exception ex)
        {
            // Network failure, timeout, malformed JSON — none of these should
            // bubble up and break submission/job creation. Log and let the
            // caller fall back to "flag for staff".
            _logger.LogError(ex, "Geocoding threw an exception for address '{Address}'.", address);
            return null;
        }
    }

    public async Task<(decimal DistanceKm, int DurationMinutes)?> GetDistanceAsync(
        decimal originLat, decimal originLng,
        decimal destLat, decimal destLng)
    {
        // OSRM wants coordinates as longitude,latitude — the OPPOSITE order
        // from how they're stored/passed everywhere else in this codebase
        // (Google-style lat,lng). Getting this backwards silently returns a
        // route between the wrong points rather than an obvious error.
        var url = $"{_osrmBaseUrl}/route/v1/driving/{originLng},{originLat};{destLng},{destLat}?overview=false";

        try
        {
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("OSRM call failed with status {StatusCode} ({OriginLat},{OriginLng} -> {DestLat},{DestLng}).",
                    response.StatusCode, originLat, originLng, destLat, destLng);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync();
            var parsed = JsonSerializer.Deserialize<OsrmRouteResponse>(body);

            if (parsed is null || parsed.Code != "Ok" || parsed.Routes.Count == 0)
            {
                _logger.LogInformation("OSRM found no route ({OriginLat},{OriginLng} -> {DestLat},{DestLng}), code: {Code}.",
                    originLat, originLng, destLat, destLng, parsed?.Code);
                return null;
            }

            var route = parsed.Routes[0];
            var distanceKm = Math.Round((decimal)route.Distance / 1000m, 2);
            var durationMinutes = (int)Math.Ceiling(route.Duration / 60.0);

            return (distanceKm, durationMinutes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OSRM threw an exception ({OriginLat},{OriginLng} -> {DestLat},{DestLng}).",
                originLat, originLng, destLat, destLng);
            return null;
        }
    }
}
