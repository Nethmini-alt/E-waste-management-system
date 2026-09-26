namespace EWasteManagement.API.Features.Processing.DTOs;

public class WarehouseLocationLookupResponse
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}

public class RatePolicyLookupResponse
{
    public Guid Id { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public decimal RatePerKg { get; set; }
    public bool IsActive { get; set; }
    public DateTime EffectiveFrom { get; set; }
}

// Deliberately minimal: the collector's display name (from their user account) and vehicle.
// No email, phone, location or credentials — this feeds dropdowns and payment rows only.
public class CollectorLookupResponse
{
    public Guid CollectorId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string VehicleType { get; set; } = string.Empty;
}
