using System.Text.Json.Serialization;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

// These mirror Google's response shape exactly (not our own domain model) —
// kept internal so nothing outside this folder depends on Google's JSON format.

internal class GeocodeResponse
{
    [JsonPropertyName("results")]
    public List<GeocodeResult> Results { get; set; } = new();

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
}

internal class GeocodeResult
{
    [JsonPropertyName("geometry")]
    public GeocodeGeometry Geometry { get; set; } = new();
}

internal class GeocodeGeometry
{
    [JsonPropertyName("location")]
    public GeocodeLocation Location { get; set; } = new();
}

internal class GeocodeLocation
{
    [JsonPropertyName("lat")]
    public decimal Lat { get; set; }

    [JsonPropertyName("lng")]
    public decimal Lng { get; set; }
}

internal class DistanceMatrixResponse
{
    [JsonPropertyName("rows")]
    public List<DistanceMatrixRow> Rows { get; set; } = new();

    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;
}

internal class DistanceMatrixRow
{
    [JsonPropertyName("elements")]
    public List<DistanceMatrixElement> Elements { get; set; } = new();
}

internal class DistanceMatrixElement
{
    [JsonPropertyName("status")]
    public string Status { get; set; } = string.Empty;

    [JsonPropertyName("distance")]
    public DistanceMatrixValue? Distance { get; set; }

    [JsonPropertyName("duration")]
    public DistanceMatrixValue? Duration { get; set; }
}

internal class DistanceMatrixValue
{
    // Google returns distance in metres and duration in seconds.
    [JsonPropertyName("value")]
    public int Value { get; set; }
}
