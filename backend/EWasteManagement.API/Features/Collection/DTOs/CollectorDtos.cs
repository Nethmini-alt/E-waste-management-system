namespace EWasteManagement.API.Features.Collection.DTOs;

public class CreateCollectorProfileDto
{
    public string VehicleType { get; set; } = string.Empty;
    public decimal CapacityKg { get; set; }
}

public class UpdateAvailabilityDto
{
    public bool IsAvailable { get; set; }
}

public class UpdateLocationDto
{
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
}

public class CollectorResponseDto
{
    public Guid CollectorId { get; set; }
    public Guid UserId { get; set; }
    public string VehicleType { get; set; } = string.Empty;
    public decimal CapacityKg { get; set; }
    public bool IsAvailable { get; set; }
    public decimal Rating { get; set; }
    public decimal? CurrentLatitude { get; set; }
    public decimal? CurrentLongitude { get; set; }
    public DateTime? LocationUpdatedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
