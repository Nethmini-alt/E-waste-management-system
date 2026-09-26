namespace EWasteManagement.API.Features.Sales.DTOs;

// ---------- Response ----------
public class MaterialPricingResponse
{
    public Guid PricingId { get; set; }
    public string MaterialType { get; set; } = string.Empty;
    public decimal PricePerKg { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string Status { get; set; } = string.Empty;    // "Draft" | "Approved" | "Expired"

    /// <summary>
    /// True when this price may be used to price an order right now — i.e. it is Approved
    /// and its expiry date has not passed. Status alone is not enough: a row keeps reading
    /// "Approved" until the background sweeper flips it, so use this flag for anything that
    /// depends on whether the price is actually usable.
    /// </summary>
    public bool IsLive { get; set; }

    public Guid CreatedByUserId { get; set; }
    public string CreatedByName { get; set; } = string.Empty;   // populated from User.FullName
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// ---------- Create ----------
public class CreateMaterialPricingRequest
{
    public string MaterialType { get; set; } = string.Empty;
    public decimal PricePerKg { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    // Status is NOT set by client — new rows always start as "Draft"
}

// ---------- Update ----------
public class UpdateMaterialPricingRequest
{
    public string MaterialType { get; set; } = string.Empty;
    public decimal PricePerKg { get; set; }
    public DateOnly EffectiveDate { get; set; }
    public DateOnly? ExpiryDate { get; set; }
    public string Status { get; set; } = "Draft";    // "Draft" | "Approved" | "Expired"
}

// ---------- Filter ----------
public class MaterialPricingFilter
{
    public string? MaterialType { get; set; }
    public string? Status { get; set; }
}