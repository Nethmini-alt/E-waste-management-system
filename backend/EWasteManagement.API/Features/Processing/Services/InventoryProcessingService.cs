using System.Linq.Expressions;
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

        // Classified is reachable only through ClassifyAsync, so an item can never be
        // "Classified" without a category and a ClassificationRecord.
        if (nextStatus == InventoryStatus.Classified
            && item.Status is InventoryStatus.Sorting or InventoryStatus.Dismantling)
            throw new ArgumentException(
                "An item can only become Classified through PUT /api/v1/inventory/{id}/classify, so that it receives a category.");

        item.TransitionTo(nextStatus, staffId, notes);

        if (newLocationId.HasValue)
            await ApplyLocationChangeAsync(item, newLocationId.Value, staffId, cancellationToken);

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

        await ApplyLocationChangeAsync(item, newLocationId, staffId, cancellationToken);
        await _db.SaveChangesAsync(cancellationToken);
    }

    // Every real location change writes a LocationMoved log row, whichever endpoint caused it.
    // Location stays editable in every status (items are physically moved even after ReadyForSale).
    private async Task ApplyLocationChangeAsync(InventoryItem item, Guid newLocationId, Guid staffId, CancellationToken cancellationToken)
    {
        var names = await _db.WarehouseLocations.AsNoTracking()
            .Where(l => l.Id == newLocationId || l.Id == item.CurrentLocationId)
            .ToDictionaryAsync(l => l.Id, l => l.Name, cancellationToken);

        if (!names.TryGetValue(newLocationId, out var newName))
            throw new KeyNotFoundException($"WarehouseLocation '{newLocationId}' was not found.");

        if (newLocationId == item.CurrentLocationId)
            return;

        var oldName = names.GetValueOrDefault(item.CurrentLocationId, item.CurrentLocationId.ToString());
        item.CurrentLocationId = newLocationId;
        _db.ProcessingLogs.Add(new ProcessingLog
        {
            InventoryItemId = item.Id, Action = "LocationMoved", PerformedByStaffId = staffId,
            Notes = $"Moved from '{oldName}' to '{newName}'."
        });
    }

    public async Task<PagedResponse<InventoryItemListItemResponse>> ListAsync(InventoryListQuery q, CancellationToken cancellationToken = default)
    {
        var query = _db.InventoryItems.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var term = q.Search.Trim().ToLowerInvariant();
            query = query.Where(i => i.ItemType.ToLower().Contains(term));
        }
        if (q.Status.HasValue)
        {
            var status = q.Status.Value;
            query = query.Where(i => i.Status == status);
        }
        if (q.OriginType.HasValue)
        {
            var origin = q.OriginType.Value;
            query = query.Where(i => i.OriginType == origin);
        }
        if (q.LocationId.HasValue)
        {
            var locationId = q.LocationId.Value;
            query = query.Where(i => i.CurrentLocationId == locationId);
        }
        if (q.ParentId.HasValue)
        {
            var parentId = q.ParentId.Value;
            query = query.Where(i => i.ParentInventoryItemId == parentId);
        }
        if (q.Category.HasValue)
        {
            var category = q.Category.Value;
            query = query.Where(i => _db.ClassificationRecords.Any(c => c.InventoryItemId == i.Id && c.Category == category));
        }

        var ordered = q.SortBy switch
        {
            InventorySortField.ItemType => OrderBy(query, i => i.ItemType, q.Descending),
            InventorySortField.WeightKg => OrderBy(query, i => i.VerifiedWeightKg, q.Descending),
            InventorySortField.Status => OrderBy(query, i => i.Status, q.Descending),
            _ => OrderBy(query, i => i.CreatedAt, q.Descending)
        };

        var totalCount = await query.CountAsync(cancellationToken);

        var rows = await ordered.ThenBy(i => i.Id)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .Select(i => new
            {
                i.Id, i.ItemType, i.Status, i.OriginType, i.VerifiedWeightKg, i.CurrentLocationId,
                LocationName = i.CurrentLocation!.Name,
                i.ParentInventoryItemId, i.CreatedAt,
                Category = _db.ClassificationRecords
                    .Where(c => c.InventoryItemId == i.Id)
                    .OrderByDescending(c => c.ClassifiedAt)
                    .Select(c => (ClassificationCategory?)c.Category)
                    .FirstOrDefault()
            })
            .ToListAsync(cancellationToken);

        return new PagedResponse<InventoryItemListItemResponse>
        {
            Items = rows.Select(r => new InventoryItemListItemResponse
            {
                Id = r.Id, ItemType = r.ItemType, Status = r.Status.ToString(), OriginType = r.OriginType.ToString(),
                VerifiedWeightKg = r.VerifiedWeightKg, CurrentLocationId = r.CurrentLocationId,
                CurrentLocationName = r.LocationName, ParentInventoryItemId = r.ParentInventoryItemId,
                Category = r.Category?.ToString(), ReceivedAt = r.CreatedAt
            }).ToList(),
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)q.PageSize)
        };
    }

    private static IOrderedQueryable<InventoryItem> OrderBy<TKey>(
        IQueryable<InventoryItem> source, Expression<Func<InventoryItem, TKey>> key, bool descending)
        => descending ? source.OrderByDescending(key) : source.OrderBy(key);

    public async Task<InventoryItemDetailResponse> GetByIdAsync(Guid inventoryItemId, CancellationToken cancellationToken = default)
    {
        var item = await _db.InventoryItems.AsNoTracking()
            .Include(i => i.CurrentLocation)
            .FirstOrDefaultAsync(i => i.Id == inventoryItemId, cancellationToken)
            ?? throw new KeyNotFoundException($"InventoryItem '{inventoryItemId}' was not found.");

        var classification = await _db.ClassificationRecords.AsNoTracking()
            .Where(c => c.InventoryItemId == inventoryItemId)
            .OrderByDescending(c => c.ClassifiedAt)
            .FirstOrDefaultAsync(cancellationToken);

        var children = await _db.InventoryItems.AsNoTracking()
            .Where(c => c.ParentInventoryItemId == inventoryItemId)
            .OrderBy(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

        // Older extra-waste items were saved without ExtraWasteReceiptId; the receipt line still links to them.
        var receiptId = item.ExtraWasteReceiptId
            ?? await _db.ExtraWasteReceiptItems.AsNoTracking()
                .Where(r => r.InventoryItemId == inventoryItemId)
                .Select(r => (Guid?)r.ExtraWasteReceiptId)
                .FirstOrDefaultAsync(cancellationToken);

        return new InventoryItemDetailResponse
        {
            Id = item.Id, ItemType = item.ItemType, Status = item.Status.ToString(), OriginType = item.OriginType.ToString(),
            VerifiedWeightKg = item.VerifiedWeightKg, CurrentLocationId = item.CurrentLocationId,
            CurrentLocationName = item.CurrentLocation?.Name ?? string.Empty,
            JobId = item.JobId, SubmissionId = item.SubmissionId, ExtraWasteReceiptId = receiptId,
            ParentInventoryItemId = item.ParentInventoryItemId, ReceivedAt = item.CreatedAt,
            Classification = classification is null ? null : new InventoryClassificationSummary
            {
                Category = classification.Category.ToString(), SubCategory = classification.SubCategory,
                Source = classification.Source.ToString(), ConfidenceScore = classification.ConfidenceScore,
                IsFinal = classification.IsFinal, ClassifiedByStaffId = classification.ClassifiedByStaffId,
                ClassifiedAt = classification.ClassifiedAt
            },
            Children = children.Select(c => new InventoryChildSummary
            {
                Id = c.Id, ItemType = c.ItemType, Status = c.Status.ToString(), VerifiedWeightKg = c.VerifiedWeightKg
            }).ToList()
        };
    }
}