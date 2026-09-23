namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// One line of a sales order: a quantity of a recovered material at a locked-in price.
/// </summary>
public class SalesOrderItem
{
    public Guid SalesOrderItemId { get; set; } = Guid.NewGuid();
    public Guid SalesOrderId { get; set; }

    /// <summary>Soft FK to Component C's recovered_materials table.</summary>
    public Guid RecoveredMaterialId { get; set; }

    /// <summary>Snapshot of material type at order time (for reports after C's schema changes).</summary>
    public string MaterialType { get; set; } = string.Empty;

    public decimal QuantityKg { get; set; }

    /// <summary>Locked-in price from the approved MaterialPricing at order time.</summary>
    public decimal UnitPrice { get; set; }

    /// <summary>QuantityKg × UnitPrice. Computed but stored for query/report performance.</summary>
    public decimal LineTotal { get; set; }

    // Navigation
    public SalesOrder SalesOrder { get; set; } = null!;
}