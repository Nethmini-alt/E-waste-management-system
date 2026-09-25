using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

/// <summary>
/// Reads sellable recovered materials from processing inventory while preserving
/// the provider contract used by the Sales feature.
/// </summary>
public sealed class EfRecoveredMaterialsProvider : IRecoveredMaterialsProvider
{
    private readonly ApplicationDbContext _db;

    public EfRecoveredMaterialsProvider(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<RecoveredMaterialResponse>> GetAllAsync(CancellationToken ct = default)
    {
        var items = await _db.InventoryItems
            .AsNoTracking()
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(ct);

        return await MapWithAvailabilityAsync(items, ct);
    }

    public async Task<IReadOnlyList<RecoveredMaterialResponse>> GetAvailableAsync(CancellationToken ct = default)
    {
        var items = await _db.InventoryItems
            .AsNoTracking()
            .Where(item => item.Status == InventoryStatus.ReadyForSale)
            .OrderByDescending(item => item.CreatedAt)
            .ToListAsync(ct);

        return (await MapWithAvailabilityAsync(items, ct))
            .Where(material => material.QuantityKg > 0)
            .ToList();
    }

    public async Task<RecoveredMaterialResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var item = await _db.InventoryItems
            .AsNoTracking()
            .FirstOrDefaultAsync(inventoryItem => inventoryItem.Id == id, ct);

        if (item is null)
            return null;

        return (await MapWithAvailabilityAsync(new[] { item }, ct)).Single();
    }

    private async Task<IReadOnlyList<RecoveredMaterialResponse>> MapWithAvailabilityAsync(
        IReadOnlyList<InventoryItem> items, CancellationToken ct)
    {
        if (items.Count == 0)
            return Array.Empty<RecoveredMaterialResponse>();

        var ids = items.Select(item => item.Id).ToList();
        var reserved = new Dictionary<Guid, decimal>();

        var salesReservations = await _db.SalesOrderItems
            .AsNoTracking()
            .Where(line => ids.Contains(line.RecoveredMaterialId)
                && line.SalesOrder.Status != SalesOrderStatus.Cancelled)
            .GroupBy(line => line.RecoveredMaterialId)
            .Select(group => new { Id = group.Key, Quantity = group.Sum(line => line.QuantityKg) })
            .ToListAsync(ct);

        foreach (var reservation in salesReservations)
            reserved[reservation.Id] = reservation.Quantity;

        var exportReservations = await _db.ExportOrderItems
            .AsNoTracking()
            .Where(line => ids.Contains(line.RecoveredMaterialId)
                && line.ExportOrder.Status != ExportOrderStatus.Cancelled)
            .GroupBy(line => line.RecoveredMaterialId)
            .Select(group => new { Id = group.Key, Quantity = group.Sum(line => line.QuantityKg) })
            .ToListAsync(ct);

        foreach (var reservation in exportReservations)
            reserved[reservation.Id] = reserved.GetValueOrDefault(reservation.Id) + reservation.Quantity;

        return items.Select(item => new RecoveredMaterialResponse
        {
            RecoveredMaterialId = item.Id,
            MaterialType = item.ItemType,
            QuantityKg = Math.Max(0, item.VerifiedWeightKg - reserved.GetValueOrDefault(item.Id)),
            QualityGrade = string.Empty,
            ProcessingStatus = item.Status == InventoryStatus.ReadyForSale ? "Ready" : item.Status.ToString(),
            SafetyValidated = item.Status == InventoryStatus.ReadyForSale,
            WorkflowId = item.SubmissionId ?? item.JobId,
            AvailableAt = item.CreatedAt
        }).ToList();
    }
}