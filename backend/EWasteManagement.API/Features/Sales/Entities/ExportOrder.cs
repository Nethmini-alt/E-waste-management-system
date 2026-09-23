namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// An export sale of recovered materials to a foreign buyer.
/// Owned by Component D. Distinct from SalesOrder due to destination country,
/// shipment date, and cross-border business rules.
/// </summary>
public class ExportOrder
{
    public Guid ExportOrderId { get; set; } = Guid.NewGuid();
    public Guid BuyerId { get; set; }

    public DateTime OrderDate { get; set; } = DateTime.UtcNow;

    /// <summary>ISO 3166-1 alpha-2 code preferred (e.g. "IN", "CN"), free text accepted.</summary>
    public string DestinationCountry { get; set; } = string.Empty;

    public DateOnly ShipmentDate { get; set; }

    public decimal TotalWeightKg { get; set; }
    public decimal TotalValue { get; set; }

    public ExportOrderStatus Status { get; set; } = ExportOrderStatus.Draft;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Guid CreatedByUserId { get; set; }

    // Navigation
    public Buyer Buyer { get; set; } = null!;
    public ICollection<ExportOrderItem> Items { get; set; } = new List<ExportOrderItem>();
}

public enum ExportOrderStatus
{
    Draft,
    PendingApproval,   // high-impact — goes through human approval (FR-D09)
    Approved,
    Shipped,
    Completed,
    Cancelled
}