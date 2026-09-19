namespace EWasteManagement.API.Features.Sales.DTOs;

// ---------- Response ----------
public class RevenueTransactionResponse
{
    public Guid RevenueId { get; set; }
    public string TransactionType { get; set; } = string.Empty;    // "LocalSale" | "Export"
    public Guid ReferenceId { get; set; }
    public decimal Amount { get; set; }
    public DateTime TransactionDate { get; set; }
    public string? Remarks { get; set; }
    public Guid RecordedByUserId { get; set; }
    public string RecordedByName { get; set; } = string.Empty;
}

// ---------- Summary ----------
public class RevenueSummaryResponse
{
    public decimal TotalRevenue { get; set; }
    public decimal LocalSaleRevenue { get; set; }
    public decimal ExportRevenue { get; set; }
    public int TransactionCount { get; set; }
    public List<MonthlyRevenueResponse> Monthly { get; set; } = new();
}

public class MonthlyRevenueResponse
{
    /// <summary>Format: "YYYY-MM"</summary>
    public string Month { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public int Count { get; set; }
}

// ---------- Filter ----------
public class RevenueFilter
{
    public string? TransactionType { get; set; }   // "LocalSale" | "Export"
    public DateTime? FromDate { get; set; }
    public DateTime? ToDate { get; set; }
}