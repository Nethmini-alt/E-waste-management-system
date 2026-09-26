namespace EWasteManagement.API.Features.Collection.DTOs;

// Shared by both GET /collectors/available (staff, query string) and
// POST /collectors/match (the Matcher agent's tool call, JSON body).
public class MatchRequestDto
{
    public decimal PickupLatitude { get; set; }
    public decimal PickupLongitude { get; set; }

    // Optional filters — omit to match against any available collector.
    public decimal? RequiredCapacityKg { get; set; }
    public decimal? RadiusKm { get; set; }
    public int MaxResults { get; set; } = 5;

    // Collectors to skip — this is how the reject-and-reassign flow excludes
    // whoever already turned this job down.
    public List<Guid>? ExcludeCollectorIds { get; set; }
}

public class CollectorMatchDto
{
    public Guid CollectorId { get; set; }
    public string CollectorName { get; set; } = string.Empty;
    public string VehicleType { get; set; } = string.Empty;
    public decimal CapacityKg { get; set; }
    public decimal Rating { get; set; }
    public int ActiveJobCount { get; set; }

    // Null means the routing service couldn't resolve a route for this candidate —
    // it's still returned (sorted last) rather than silently dropped, so
    // staff/agent can see something went wrong rather than just seeing fewer results.
    public decimal? DistanceKm { get; set; }
    public int? EtaMinutes { get; set; }
}
