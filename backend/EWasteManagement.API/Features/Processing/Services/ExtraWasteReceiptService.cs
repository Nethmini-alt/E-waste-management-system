using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class ExtraWasteReceiptService : IExtraWasteReceiptService
{
    private readonly ApplicationDbContext _db;

    public ExtraWasteReceiptService(ApplicationDbContext db) => _db = db;

    public async Task<ReceiveExtraWasteResponse> ReceiveAsync(
        ReceiveExtraWasteRequest request, Guid receivedByStaffId, CancellationToken cancellationToken = default)
    {
        // Idempotency: a repeated call with the same key returns the original result
        // instead of creating a duplicate receipt.
        if (!string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            var existing = await _db.ExtraWasteReceipts
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.IdempotencyKey == request.IdempotencyKey, cancellationToken);

            if (existing is not null)
                return MapToResponse(existing);
        }

        var locationExists = await _db.WarehouseLocations
            .AnyAsync(l => l.Id == request.WarehouseLocationId, cancellationToken);
        if (!locationExists)
            throw new KeyNotFoundException($"WarehouseLocation '{request.WarehouseLocationId}' was not found.");

        var receipt = new ExtraWasteReceipt
        {
            CollectorId = request.CollectorId,
            ReceivedByStaffId = receivedByStaffId,
            Notes = request.Notes,
            IdempotencyKey = request.IdempotencyKey
        };

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        foreach (var itemRequest in request.Items)
        {
            var item = new ExtraWasteReceiptItem
            {
                ItemType = itemRequest.ItemType,
                WeightKg = itemRequest.WeightKg,
                Accepted = itemRequest.Accepted,
                RejectionReason = itemRequest.Accepted ? null : itemRequest.RejectionReason
            };

            if (itemRequest.Accepted)
            {
                var inventoryItem = new InventoryItem
                {
                    OriginType = OriginType.ExtraWaste,
                    ItemType = itemRequest.ItemType,
                    VerifiedWeightKg = itemRequest.WeightKg,
                    CurrentLocationId = request.WarehouseLocationId
                };
                inventoryItem.MarkReceived(receivedByStaffId,
                    $"Received via extra-waste receipt from collector {request.CollectorId}");

                _db.InventoryItems.Add(inventoryItem);
                item.InventoryItem = inventoryItem;
                item.InventoryItemId = inventoryItem.Id;
            }

            receipt.Items.Add(item);
        }

        _db.ExtraWasteReceipts.Add(receipt);
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return MapToResponse(receipt);
    }

    private static ReceiveExtraWasteResponse MapToResponse(ExtraWasteReceipt receipt) => new()
    {
        ExtraWasteReceiptId = receipt.Id,
        ReceivedAt = receipt.ReceivedAt,
        Items = receipt.Items.Select(i => new ExtraWasteReceiptItemResult
        {
            ItemType = i.ItemType,
            Accepted = i.Accepted,
            RejectionReason = i.RejectionReason,
            InventoryItemId = i.InventoryItemId
        }).ToList()
    };
}