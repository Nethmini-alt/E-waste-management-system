using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Services;

public interface IRevenueService
{
    Task<IReadOnlyList<RevenueTransactionResponse>> GetAllAsync(
        RevenueFilter filter, CancellationToken ct = default);

    Task<RevenueTransactionResponse> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<RevenueSummaryResponse> GetSummaryAsync(CancellationToken ct = default);

    /// <summary>
    /// Create a revenue row for a completed order. Idempotent — returns the existing row
    /// if one already exists for the same (type, referenceId).
    /// Called internally by SalesOrderService and ExportOrderService.
    /// </summary>
    Task<RevenueTransaction> RecordOrderRevenueAsync(
        RevenueType type,
        Guid referenceId,
        decimal amount,
        Guid recordedByUserId,
        string? remarks = null,
        CancellationToken ct = default);
}

public class RevenueService : IRevenueService
{
    private readonly ApplicationDbContext _db;

    public RevenueService(ApplicationDbContext db) => _db = db;

    // ---------- Reads ----------

    public async Task<IReadOnlyList<RevenueTransactionResponse>> GetAllAsync(
        RevenueFilter filter, CancellationToken ct = default)
    {
        var q = _db.RevenueTransactions
            .AsNoTracking()
            .Include(r => r.RecordedByUser)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.TransactionType)
            && Enum.TryParse<RevenueType>(filter.TransactionType, true, out var type))
        {
            q = q.Where(r => r.TransactionType == type);
        }

        if (filter.FromDate.HasValue)
            q = q.Where(r => r.TransactionDate >= filter.FromDate.Value);

        if (filter.ToDate.HasValue)
            q = q.Where(r => r.TransactionDate <= filter.ToDate.Value);

        // Join to User for RecordedByName
        var rows = await q
            .OrderByDescending(r => r.TransactionDate)
            .Join(_db.Users.AsNoTracking(),
                  r => r.RecordedByUserId,
                  u => u.UserId,
                  (r, u) => new RevenueTransactionResponse
                  {
                      RevenueId = r.RevenueId,
                      TransactionType = r.TransactionType.ToString(),
                      ReferenceId = r.ReferenceId,
                      Amount = r.Amount,
                      TransactionDate = r.TransactionDate,
                      Remarks = r.Remarks,
                      RecordedByUserId = r.RecordedByUserId,
                      RecordedByName = u.FullName
                  })
            .ToListAsync(ct);

        return rows;
    }

    public async Task<RevenueTransactionResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var row = await _db.RevenueTransactions
            .AsNoTracking()
            .Where(r => r.RevenueId == id)
            .Join(_db.Users.AsNoTracking(),
                  r => r.RecordedByUserId,
                  u => u.UserId,
                  (r, u) => new RevenueTransactionResponse
                  {
                      RevenueId = r.RevenueId,
                      TransactionType = r.TransactionType.ToString(),
                      ReferenceId = r.ReferenceId,
                      Amount = r.Amount,
                      TransactionDate = r.TransactionDate,
                      Remarks = r.Remarks,
                      RecordedByUserId = r.RecordedByUserId,
                      RecordedByName = u.FullName
                  })
            .FirstOrDefaultAsync(ct)
            ?? throw new KeyNotFoundException($"Revenue transaction {id} not found.");

        return row;
    }

    public async Task<RevenueSummaryResponse> GetSummaryAsync(CancellationToken ct = default)
    {
        var all = await _db.RevenueTransactions.AsNoTracking().ToListAsync(ct);

        var summary = new RevenueSummaryResponse
        {
            TotalRevenue = all.Sum(r => r.Amount),
            LocalSaleRevenue = all.Where(r => r.TransactionType == RevenueType.LocalSale).Sum(r => r.Amount),
            ExportRevenue = all.Where(r => r.TransactionType == RevenueType.Export).Sum(r => r.Amount),
            TransactionCount = all.Count,
            Monthly = all
                .GroupBy(r => r.TransactionDate.ToString("yyyy-MM"))
                .Select(g => new MonthlyRevenueResponse
                {
                    Month = g.Key,
                    Amount = g.Sum(r => r.Amount),
                    Count = g.Count()
                })
                .OrderByDescending(x => x.Month)
                .ToList()
        };

        return summary;
    }

    // ---------- Write (called internally) ----------

    public async Task<RevenueTransaction> RecordOrderRevenueAsync(
        RevenueType type,
        Guid referenceId,
        decimal amount,
        Guid recordedByUserId,
        string? remarks = null,
        CancellationToken ct = default)
    {
        // Idempotency: if a row already exists, return it
        var existing = await _db.RevenueTransactions
            .FirstOrDefaultAsync(r => r.TransactionType == type && r.ReferenceId == referenceId, ct);
        if (existing is not null) return existing;

        var tx = new RevenueTransaction
        {
            TransactionType = type,
            ReferenceId = referenceId,
            Amount = amount,
            TransactionDate = DateTime.UtcNow,
            RecordedByUserId = recordedByUserId,
            Remarks = remarks
        };

        _db.RevenueTransactions.Add(tx);
        // NOTE: do NOT call SaveChanges here. The caller (SalesOrderService /
        // ExportOrderService) saves in the same transaction as the order status update.
        return tx;
    }
}