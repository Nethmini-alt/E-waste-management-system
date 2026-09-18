using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Shared.Common;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class InventoryProcessingService : IInventoryProcessingService
{
    private readonly ApplicationDbContext _db;
    public InventoryProcessingService(ApplicationDbContext db) => _db = db;

    private async Task<InventoryItem> LoadItemAsync(Guid id, CancellationToken cancellationToken)
        => await _db.InventoryItems.FirstOrDefaultAsync(i => i.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException($"InventoryItem '{id}' was not found.");

    public async Task<InventoryItemStatusResponse> TransitionStatusAsync(
        Guid inventoryItemId, InventoryStatus nextStatus, Guid staffId, string? notes, Guid? newLocationId,
        CancellationToken cancellationToken = default)
    {
        var item = await LoadItemAsync(inventoryItemId, cancellationToken);

        if (newLocationId.HasValue)
        {
            var locationExists = await _db.WarehouseLocations.AnyAsync(l => l.Id == newLocationId.Value, cancellationToken);
            if (!locationExists)
                throw new KeyNotFoundException($"WarehouseLocation '{newLocationId}' was not found.");
            item.CurrentLocationId = newLocationId.Value;
        }

        item.TransitionTo(nextStatus, staffId, notes);
        await _db.SaveChangesAsync(cancellationToken);

        return new InventoryItemStatusResponse { Id = item.Id, Status = item.Status.ToString(), CurrentLocationId = item.CurrentLocationId };
    }

    public async Task<DismantleLogResponse> AddDismantleLogAsync(
        Guid inventoryItemId, AddDismantleLogRequest request, Guid staffId, CancellationToken cancellationToken = default)
    {
        var item = await LoadItemAsync(inventoryItemId, cancellationToken);

        if (item.Status != InventoryStatus.Sorting && item.Status != InventoryStatus.Dismantling)
            throw new InvalidStatusTransitionException(item.Status.ToString(), InventoryStatus.Dismantling.ToString());

        // The first dismantle action moves the item into Dismantling; later ones just add to the log.
        if (item.Status == InventoryStatus.Sorting)
            item.TransitionTo(InventoryStatus.Dismantling, staffId, "Dismantling started");

        _db.ProcessingLogs.Add(new ProcessingLog
        {
            InventoryItemId = item.Id,
            Action = "DismantleStep",
            PerformedByStaffId = staffId,
            Notes = request.Description
        });

        if (request.RemainingWeightKg.HasValue)
            item.VerifiedWeightKg = request.RemainingWeightKg.Value;

        var childIds = new List<Guid>();
        foreach (var child in request.ChildItems)
        {
            var childItem = new InventoryItem
            {
                OriginType = item.OriginType,
                ParentInventoryItemId = item.Id,
                ItemType = child.ItemType,
                VerifiedWeightKg = child.WeightKg,
                CurrentLocationId = item.CurrentLocationId
            };
            childItem.MarkReceived(staffId, $"Created by dismantling parent item {item.Id}.");
            _db.InventoryItems.Add(childItem);
            childIds.Add(childItem.Id);
        }

        await _db.SaveChangesAsync(cancellationToken);

        return new DismantleLogResponse
        {
            InventoryItemId = item.Id,
            UpdatedWeightKg = request.RemainingWeightKg,
            ChildInventoryItemIds = childIds
        };
    }

    public async Task<ClassificationResponse> ClassifyAsync(
        Guid inventoryItemId, ClassifyInventoryItemRequest request, Guid staffId, CancellationToken cancellationToken = default)
    {
        var item = await LoadItemAsync(inventoryItemId, cancellationToken);

        if (item.Status != InventoryStatus.Sorting && item.Status != InventoryStatus.Dismantling)
            throw new InvalidStatusTransitionException(item.Status.ToString(), InventoryStatus.Classified.ToString());

        var record = new ClassificationRecord
        {
            InventoryItemId = item.Id,
            Category = request.Category,
            SubCategory = request.SubCategory,
            Source = request.Source,
            ConfidenceScore = request.ConfidenceScore,
            ClassifiedByStaffId = staffId,
            IsFinal = request.IsFinal
        };
        _db.ClassificationRecords.Add(record);

        item.TransitionTo(InventoryStatus.Classified, staffId,
            $"Classified as {request.Category}" + (request.SubCategory is null ? "" : $" / {request.SubCategory}"));

        // Hazard rule: enforced in code, not convention — a hazardous item is quarantined
        // immediately, in the same request, before it can ever reach ReadyForSale.
        if (request.Category == ClassificationCategory.Hazardous)
            item.TransitionTo(InventoryStatus.OnHold, staffId, "Automatically quarantined — classified Hazardous");

        await _db.SaveChangesAsync(cancellationToken);

        return new ClassificationResponse
        {
            InventoryItemId = item.Id,
            Category = record.Category.ToString(),
            Status = item.Status.ToString(),
            IsFinal = record.IsFinal
        };
    }

    public async Task<IReadOnlyList<ProcessingLogEntryResponse>> GetHistoryAsync(Guid inventoryItemId, CancellationToken cancellationToken = default)
    {
        var exists = await _db.InventoryItems.AnyAsync(i => i.Id == inventoryItemId, cancellationToken);
        if (!exists)
            throw new KeyNotFoundException($"InventoryItem '{inventoryItemId}' was not found.");

        return await _db.ProcessingLogs.AsNoTracking()
            .Where(l => l.InventoryItemId == inventoryItemId)
            .OrderBy(l => l.PerformedAt)
            .Select(l => new ProcessingLogEntryResponse
            {
                Action = l.Action, PerformedByStaffId = l.PerformedByStaffId, PerformedAt = l.PerformedAt, Notes = l.Notes
            })
            .ToListAsync(cancellationToken);
    }

    public async Task MoveLocationAsync(Guid inventoryItemId, Guid newLocationId, Guid staffId, CancellationToken cancellationToken = default)
    {
        var item = await LoadItemAsync(inventoryItemId, cancellationToken);

        var locationExists = await _db.WarehouseLocations.AnyAsync(l => l.Id == newLocationId, cancellationToken);
        if (!locationExists)
            throw new KeyNotFoundException($"WarehouseLocation '{newLocationId}' was not found.");

        item.CurrentLocationId = newLocationId;
        _db.ProcessingLogs.Add(new ProcessingLog
        {
            InventoryItemId = item.Id, Action = "LocationMoved", PerformedByStaffId = staffId,
            Notes = $"Moved to location {newLocationId}"
        });

        await _db.SaveChangesAsync(cancellationToken);
    }
}