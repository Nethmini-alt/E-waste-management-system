using System.Net;
using System.Text.Json;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

public class GoogleMapsService : IGoogleMapsService
{
    private const string GeocodeBaseUrl = "https://maps.googleapis.com/maps/api/geocode/json";
    private const string DistanceMatrixBaseUrl = "https://maps.googleapis.com/maps/api/distancematrix/json";

    private readonly HttpClient _httpClient;
    private readonly ILogger<GoogleMapsService> _logger;
    private readonly string _apiKey;

    public GoogleMapsService(HttpClient httpClient, IConfiguration configuration, ILogger<GoogleMapsService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _apiKey = configuration["GoogleMaps:ApiKey"]
            ?? throw new InvalidOperationException("GoogleMaps:ApiKey is missing from configuration.");
    }

    public async Task<(decimal Latitude, decimal Longitude)?> GeocodeAsync(string address)
    {
        if (string.IsNullOrWhiteSpace(address))
        {
            _logger.LogWarning("GeocodeAsync called with an empty address.");
            return null;
        }

        var url = $"{GeocodeBaseUrl}?address={Uri.EscapeDataString(address)}&key={_apiKey}";

        try
        {
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Geocoding HTTP call failed with status {StatusCode} for address '{Address}'.",
                    response.StatusCode, address);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync();
            var parsed = JsonSerializer.Deserialize<GeocodeResponse>(body);

            // "OK" means Google found at least one match. Anything else
            // (ZERO_RESULTS, OVER_QUERY_LIMIT, REQUEST_DENIED, ...) is a miss.
            if (parsed is null || parsed.Status != "OK" || parsed.Results.Count == 0)
            {
                _logger.LogInformation("Geocoding returned no usable result for address '{Address}' (status: {Status}).",
                    address, parsed?.Status);
                return null;
            }

            var location = parsed.Results[0].Geometry.Location;
            return (location.Lat, location.Lng);
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
        var origins = $"{originLat},{originLng}";
        var destinations = $"{destLat},{destLng}";
        var url = $"{DistanceMatrixBaseUrl}?origins={origins}&destinations={destinations}&mode=driving&key={_apiKey}";

        try
        {
            var response = await _httpClient.GetAsync(url);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Distance Matrix HTTP call failed with status {StatusCode} ({Origins} -> {Destinations}).",
                    response.StatusCode, origins, destinations);
                return null;
            }

            var body = await response.Content.ReadAsStringAsync();
            var parsed = JsonSerializer.Deserialize<DistanceMatrixResponse>(body);

            var element = parsed?.Rows.FirstOrDefault()?.Elements.FirstOrDefault();

            if (parsed is null || parsed.Status != "OK" || element is null || element.Status != "OK"
                || element.Distance is null || element.Duration is null)
            {
                _logger.LogInformation("Distance Matrix returned no usable route ({Origins} -> {Destinations}).",
                    origins, destinations);
                return null;
            }

            var distanceKm = Math.Round(element.Distance.Value / 1000m, 2);
            var durationMinutes = (int)Math.Ceiling(element.Duration.Value / 60.0);

            return (distanceKm, durationMinutes);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Distance Matrix threw an exception ({Origins} -> {Destinations}).", origins, destinations);
            return null;
        }
    }
}
