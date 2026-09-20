using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class ExtraWasteReceiptService : IExtraWasteReceiptService
{
    private readonly ApplicationDbContext _db;
    private readonly ICollectorPaymentService _paymentService;

    public ExtraWasteReceiptService(ApplicationDbContext db, ICollectorPaymentService paymentService)
    {
        _db = db;
        _paymentService = paymentService;
    }

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

        var collectorExists = await _db.Collectors
            .AnyAsync(c => c.CollectorId == request.CollectorId, cancellationToken);
        if (!collectorExists)
            throw new KeyNotFoundException($"Collector '{request.CollectorId}' was not found.");

        // Item types match rate policies case-insensitively; the policy's own spelling becomes the
        // stored name, so "laptop" and "Laptop" never end up as two different inventory types.
        var canonicalTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        var activeRateTypes = await _db.RatePolicies.AsNoTracking()
            .Where(r => r.IsActive).Select(r => r.ItemType).ToListAsync(cancellationToken);
        foreach (var rateType in activeRateTypes)
            canonicalTypes.TryAdd(rateType, rateType);

        // Fail with a clear 400 before writing anything, instead of discovering a missing rate
        // halfway through the transaction.
        var unsupportedTypes = request.Items
            .Where(i => i.Accepted && !canonicalTypes.ContainsKey(i.ItemType))
            .Select(i => i.ItemType).Distinct().ToList();
        if (unsupportedTypes.Count > 0)
            throw new ArgumentException(
                $"No active rate policy for item type(s): {string.Join(", ", unsupportedTypes.Select(t => $"'{t}'"))}.");

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
            var itemType = canonicalTypes.GetValueOrDefault(itemRequest.ItemType, itemRequest.ItemType);

            var item = new ExtraWasteReceiptItem
            {
                ItemType = itemType,
                WeightKg = itemRequest.WeightKg,
                Accepted = itemRequest.Accepted,
                RejectionReason = itemRequest.Accepted ? null : itemRequest.RejectionReason
            };

            if (itemRequest.Accepted)
            {
                var inventoryItem = new InventoryItem
                {
                    OriginType = OriginType.ExtraWaste,
                    ExtraWasteReceiptId = receipt.Id,
                    ItemType = itemType,
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

        var acceptedItems = receipt.Items.Where(i => i.Accepted).ToList();
        if (acceptedItems.Count > 0)
        {
            var lineItems = acceptedItems.Select(i => new PaymentLineItem(i.ItemType, i.WeightKg)).ToList();
            var paymentContext = new PaymentContext
            {
                TotalWeightKg = lineItems.Sum(l => l.WeightKg),
                LineItems = lineItems
            };

            await _paymentService.CreatePaymentAsync(
                PaymentSourceType.ExtraWaste, receipt.Id, request.CollectorId, paymentContext, cancellationToken);
        }
        
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