using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public interface IRecoveredMaterialSummaryService
{
    Task<IReadOnlyList<RecoveredMaterialGroupResponse>> GetGroupsAsync(CancellationToken cancellationToken = default);
}

public class RecoveredMaterialSummaryService : IRecoveredMaterialSummaryService
{
    private readonly ApplicationDbContext _db;

    public RecoveredMaterialSummaryService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<RecoveredMaterialGroupResponse>> GetGroupsAsync(CancellationToken cancellationToken = default)
    {
        var items = await _db.InventoryItems.AsNoTracking()
            .Where(i => i.Kind == ItemKind.Material && i.Status == InventoryStatus.ReadyForSale)
            .Select(i => new
            {
                i.Id, i.ItemType, i.VerifiedWeightKg, i.CurrentLocationId,
                LocationName = i.CurrentLocation!.Name,
                i.CreatedAt, i.ParentInventoryItemId,
                ParentItemType = i.ParentInventoryItem != null ? i.ParentInventoryItem.ItemType : null
            })
            .ToListAsync(cancellationToken);

        if (items.Count == 0)
            return Array.Empty<RecoveredMaterialGroupResponse>();

        // Same reservation rule as Sales: quantities on sales/export order lines that are not cancelled.
        // Summed in memory: SQLite (used by the tests) cannot SUM decimals.
        var ids = items.Select(i => i.Id).ToList();
        var salesLines = await _db.SalesOrderItems.AsNoTracking()
            .Where(l => ids.Contains(l.RecoveredMaterialId) && l.SalesOrder.Status != SalesOrderStatus.Cancelled)
            .Select(l => new { l.RecoveredMaterialId, l.QuantityKg })
            .ToListAsync(cancellationToken);
        var exportLines = await _db.ExportOrderItems.AsNoTracking()
            .Where(l => ids.Contains(l.RecoveredMaterialId) && l.ExportOrder.Status != ExportOrderStatus.Cancelled)
            .Select(l => new { l.RecoveredMaterialId, l.QuantityKg })
            .ToListAsync(cancellationToken);
        var reserved = salesLines.Concat(exportLines)
            .GroupBy(l => l.RecoveredMaterialId)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.QuantityKg));

        return items
            .GroupBy(i => i.ItemType, StringComparer.OrdinalIgnoreCase)
            .Select(g =>
            {
                var rows = g.OrderBy(i => i.CreatedAt).Select(i => new RecoveredMaterialItemResponse
                {
                    InventoryItemId = i.Id,
                    WeightKg = i.VerifiedWeightKg,
                    AvailableWeightKg = Math.Max(0, i.VerifiedWeightKg - reserved.GetValueOrDefault(i.Id)),
                    LocationId = i.CurrentLocationId,
                    LocationName = i.LocationName,
                    RecordedAt = i.CreatedAt,
                    ParentInventoryItemId = i.ParentInventoryItemId,
                    ParentItemType = i.ParentItemType
                }).ToList();

                return new RecoveredMaterialGroupResponse
                {
                    MaterialType = g.First().ItemType,
                    TotalWeightKg = rows.Sum(r => r.WeightKg),
                    AvailableWeightKg = rows.Sum(r => r.AvailableWeightKg),
                    ItemCount = rows.Count,
                    Items = rows
                };
            })
            .OrderBy(g => g.MaterialType, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }
}
