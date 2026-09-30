namespace EWasteManagement.API.Features.Processing.DTOs;

// GET /api/v1/inventory/recovered-materials — one row per material type, totals across every
// sellable recovered-material item, with each item (and where it is stored) underneath.
public class RecoveredMaterialGroupResponse
{
    public string MaterialType { get; set; } = string.Empty;
    public decimal TotalWeightKg { get; set; }

    /// <summary>Total minus what is already reserved on non-cancelled sales/export orders.</summary>
    public decimal AvailableWeightKg { get; set; }

    public int ItemCount { get; set; }
    public List<RecoveredMaterialItemResponse> Items { get; set; } = new();
}

public class RecoveredMaterialItemResponse
{
    public Guid InventoryItemId { get; set; }
    public decimal WeightKg { get; set; }
    public decimal AvailableWeightKg { get; set; }
    public Guid LocationId { get; set; }
    public string LocationName { get; set; } = string.Empty;
    public DateTime RecordedAt { get; set; }
    public Guid? ParentInventoryItemId { get; set; }
    public string? ParentItemType { get; set; }
}
