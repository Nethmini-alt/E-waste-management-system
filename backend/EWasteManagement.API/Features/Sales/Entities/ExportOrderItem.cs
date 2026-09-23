namespace EWasteManagement.API.Features.Sales.Entities;

public class ExportOrderItem
{
    public Guid ExportOrderItemId { get; set; } = Guid.NewGuid();
    public Guid ExportOrderId { get; set; }

    /// <summary>Soft FK to Component C's recovered_materials table.</summary>
    public Guid RecoveredMaterialId { get; set; }

    public string MaterialType { get; set; } = string.Empty;
    public decimal QuantityKg { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }

    // Navigation
    public ExportOrder ExportOrder { get; set; } = null!;
}