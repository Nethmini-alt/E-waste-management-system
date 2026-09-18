namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// A local (domestic) sale of recovered materials to a buyer.
/// Owned by Component D. Line items reference recovered material batches from Component C.
/// </summary>
public class SalesOrder
{
    public Guid SalesOrderId { get; set; } = Guid.NewGuid();
    public Guid BuyerId { get; set; }

    public DateTime OrderDate { get; set; } = DateTime.UtcNow;

    /// <summary>Server-calculated sum of all line totals. Never set by client.</summary>
    public decimal TotalAmount { get; set; }

    public SalesOrderStatus Status { get; set; } = SalesOrderStatus.Draft;

    public string? Notes { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    /// <summary>Who created this order (audit).</summary>
    public Guid CreatedByUserId { get; set; }

    // Navigation
    public Buyer Buyer { get; set; } = null!;
    public ICollection<SalesOrderItem> Items { get; set; } = new List<SalesOrderItem>();
}

public enum SalesOrderStatus
{
    Draft,
    Confirmed,
    Completed,
    Cancelled
}