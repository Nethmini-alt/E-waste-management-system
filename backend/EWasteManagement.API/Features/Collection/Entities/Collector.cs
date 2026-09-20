namespace EWasteManagement.API.Features.Collection.Entities;

public class Collector
{
    public Guid CollectorId { get; set; } = Guid.NewGuid();

    // One collector profile per Auth user (Role = Collector). No navigation
    // property back to User on purpose — Collection stays decoupled from Auth's
    // internals beyond this id.
    public Guid UserId { get; set; }

    public string VehicleType { get; set; } = string.Empty;
    public decimal CapacityKg { get; set; }

    // Live position, updated by the Flutter collector app while on shift.
    // Null until the collector has ever reported a location.
    public decimal? CurrentLatitude { get; set; }
    public decimal? CurrentLongitude { get; set; }
    public DateTime? LocationUpdatedAt { get; set; }

    public bool IsAvailable { get; set; } = false;
    public decimal Rating { get; set; } = 5.0m;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
