using EWasteManagement.API.Features.Auth.Entities;

namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// Approved pricing for a recovered material type. Managed by staff.
/// One row per (MaterialType + EffectiveDate). Only one Approved row per material
/// should be active at a time — enforced by business rules in the service layer.
/// </summary>
public class MaterialPricing
{
    public Guid PricingId { get; set; } = Guid.NewGuid();

    /// <summary>e.g. "Copper", "Aluminium", "Gold", "PCB"</summary>
    public string MaterialType { get; set; } = string.Empty;

    /// <summary>Price per kilogram in LKR (Rs.).</summary>
    public decimal PricePerKg { get; set; }

    /// <summary>Date this price takes effect.</summary>
    public DateOnly EffectiveDate { get; set; }

    /// <summary>Optional expiry. Null means "until replaced".</summary>
    public DateOnly? ExpiryDate { get; set; }

    public PricingStatus Status { get; set; } = PricingStatus.Draft;

    /// <summary>Staff member who created this pricing row.</summary>
    public Guid CreatedByUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public User CreatedBy { get; set; } = null!;
}

public enum PricingStatus
{
    Draft,
    Approved,
    Expired
}