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