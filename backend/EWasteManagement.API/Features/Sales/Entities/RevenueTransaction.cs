using EWasteManagement.API.Features.Auth.Entities;

namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// Immutable revenue ledger entry. Created automatically when a Sales or Export order
/// transitions to Completed. One row per completed order.
/// </summary>
public class RevenueTransaction
{
    public Guid RevenueId { get; set; } = Guid.NewGuid();

    public RevenueType TransactionType { get; set; }

    /// <summary>SalesOrderId or ExportOrderId, depending on TransactionType.</summary>
    public Guid ReferenceId { get; set; }

    public decimal Amount { get; set; }

    public DateTime TransactionDate { get; set; } = DateTime.UtcNow;

    public string? Remarks { get; set; }

    public Guid RecordedByUserId { get; set; }

    public User RecordedByUser { get; set; } = null!;

}

public enum RevenueType
{
    LocalSale,
    Export
}