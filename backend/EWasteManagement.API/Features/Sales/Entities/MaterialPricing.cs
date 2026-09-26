using EWasteManagement.API.Features.Auth.Entities;

namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// Approved pricing for a recovered material type. Managed by staff.
/// One row per (MaterialType + EffectiveDate).
///
/// At most ONE row per MaterialType may be <see cref="PricingStatus.Approved"/> — enforced
/// in the database by the partial unique index
/// IX_material_pricing_material_type_approved_unique, and in the service layer, which
/// expires the previous approved row when a new one is approved.
///
/// "Approved" on its own does not mean usable: a price can only price an order while it is
/// Approved AND its expiry date has not passed. See MaterialPricingPolicy.IsLive.
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

    /// <summary>
    /// Optional expiry. Null means "until replaced".
    /// Once this date arrives the price is no longer usable (the expiry day itself is
    /// already past the window), and the sweeper flips the row to Expired.
    /// </summary>
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