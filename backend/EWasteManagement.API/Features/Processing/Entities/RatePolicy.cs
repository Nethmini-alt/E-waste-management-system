using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Entities;

public class RatePolicy : BaseEntity
{
    public string ItemType { get; set; } = string.Empty;
    public decimal RatePerKg { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime EffectiveFrom { get; set; } = DateTime.UtcNow;
}
