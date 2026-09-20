using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Entities;

public class ClassificationRecord : BaseEntity
{
    public Guid InventoryItemId { get; set; }
    public InventoryItem? InventoryItem { get; set; }

    public ClassificationCategory Category { get; set; }
    public string? SubCategory { get; set; }

    public ClassificationSource Source { get; set; }
    public decimal? ConfidenceScore { get; set; }       // AI only
    public Guid? ClassifiedByStaffId { get; set; }        // set once a human confirms or classifies manually

    public bool IsFinal { get; set; }
    public Guid? OverriddenByStaffId { get; set; }
    public string? OverrideReason { get; set; }

    public DateTime ClassifiedAt { get; set; } = DateTime.UtcNow;
}
