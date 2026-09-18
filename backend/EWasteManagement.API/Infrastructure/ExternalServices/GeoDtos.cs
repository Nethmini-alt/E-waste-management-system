using System.Text.Json.Serialization;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

// Mirrors Nominatim's and OSRM's response shapes exactly (not our own domain
// model) — kept internal so nothing outside this folder depends on their JSON.

// Nominatim returns an array of matches; lat/lon come back as strings, not
// numbers, which is easy to miss.
internal class NominatimResult
{
    [JsonPropertyName("lat")]
    public string Lat { get; set; } = string.Empty;

    [JsonPropertyName("lon")]
    public string Lon { get; set; } = string.Empty;
}

internal class OsrmRouteResponse
{
    [JsonPropertyName("code")]
    public string Code { get; set; } = string.Empty;

    [JsonPropertyName("routes")]
    public List<OsrmRoute> Routes { get; set; } = new();
}

internal class OsrmRoute
{
    // OSRM returns distance in metres and duration in seconds, as numbers
    // (unlike Nominatim's coordinates, these are NOT strings).
    [JsonPropertyName("distance")]
    public double Distance { get; set; }

    [JsonPropertyName("duration")]
    public double Duration { get; set; }
}
