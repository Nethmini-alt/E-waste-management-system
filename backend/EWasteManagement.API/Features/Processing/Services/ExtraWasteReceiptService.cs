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

        // "GeneralCollection" is the rate key that prices job-collection payments, not a real item
        // type. The request validator rejects it too; this keeps the rule true for any caller.
        if (request.Items.Any(i => IsReservedItemType(i.ItemType)))
            throw new ArgumentException(
                $"'{JobPaymentCalculator.GeneralCollectionItemType}' is reserved for job-collection payments and cannot be used as an extra-waste item type.");

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
            // Only accepted lines are priced. Rejected lines are handed over separately so the payment's
            // saved snapshot keeps them (Rs. 0, with their reason) without them ever touching the total.
            var lineItems = acceptedItems.Select(i => new PaymentLineItem(i.ItemType, i.WeightKg, i.Id)).ToList();
            var rejectedLines = receipt.Items.Where(i => !i.Accepted)
                .Select(i => new RejectedLineItem(i.ItemType, i.WeightKg, i.RejectionReason, i.Id)).ToList();
            var paymentContext = new PaymentContext
            {
                TotalWeightKg = lineItems.Sum(l => l.WeightKg),
                LineItems = lineItems,
                RejectedLineItems = rejectedLines
            };

            await _paymentService.CreatePaymentAsync(
                PaymentSourceType.ExtraWaste, receipt.Id, request.CollectorId, paymentContext, receivedByStaffId, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);

        return MapToResponse(receipt);
    }

    private static bool IsReservedItemType(string? itemType)
        => string.Equals(itemType?.Trim(), JobPaymentCalculator.GeneralCollectionItemType, StringComparison.OrdinalIgnoreCase);

    public async Task<PagedResponse<ExtraWasteReceiptListItemResponse>> ListAsync(
        ExtraWasteReceiptListQuery q, CancellationToken cancellationToken = default)
    {
        var query = _db.ExtraWasteReceipts.AsNoTracking().AsQueryable();
        if (q.CollectorId.HasValue)
        {
            var collectorId = q.CollectorId.Value;
            query = query.Where(r => r.CollectorId == collectorId);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        var receipts = await query
            .Include(r => r.Items)
            .OrderByDescending(r => r.ReceivedAt).ThenBy(r => r.Id)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .ToListAsync(cancellationToken);

        var receiptIds = receipts.Select(r => r.Id).ToList();
        var payments = await _db.CollectorPayments.AsNoTracking()
            .Where(p => p.SourceType == PaymentSourceType.ExtraWaste && receiptIds.Contains(p.SourceId))
            .ToDictionaryAsync(p => p.SourceId, cancellationToken);

        var collectorIds = receipts.Select(r => r.CollectorId).Distinct().ToList();
        var collectors = await (from c in _db.Collectors.AsNoTracking()
                                join u in _db.Users.AsNoTracking() on c.UserId equals u.UserId
                                where collectorIds.Contains(c.CollectorId)
                                select new { c.CollectorId, u.FullName })
            .ToDictionaryAsync(x => x.CollectorId, x => x.FullName, cancellationToken);

        return new PagedResponse<ExtraWasteReceiptListItemResponse>
        {
            Items = receipts.Select(r =>
            {
                payments.TryGetValue(r.Id, out var payment);
                return new ExtraWasteReceiptListItemResponse
                {
                    ReceiptId = r.Id,
                    ReceivedAt = r.ReceivedAt,
                    CollectorId = r.CollectorId,
                    CollectorName = collectors.GetValueOrDefault(r.CollectorId),
                    ItemCount = r.Items.Count,
                    AcceptedCount = r.Items.Count(i => i.Accepted),
                    RejectedCount = r.Items.Count(i => !i.Accepted),
                    TotalWeightKg = r.Items.Sum(i => i.WeightKg),
                    AcceptedWeightKg = r.Items.Where(i => i.Accepted).Sum(i => i.WeightKg),
                    PaymentId = payment?.Id,
                    PaymentStatus = payment?.Status.ToString(),
                    PaymentAmount = payment?.Amount
                };
            }).ToList(),
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)q.PageSize)
        };
    }

    public async Task<ExtraWasteReceiptDetailResponse> GetDetailAsync(Guid receiptId, CancellationToken cancellationToken = default)
    {
        var receipt = await _db.ExtraWasteReceipts.AsNoTracking()
            .Include(r => r.Items)
            .FirstOrDefaultAsync(r => r.Id == receiptId, cancellationToken)
            ?? throw new KeyNotFoundException($"ExtraWasteReceipt '{receiptId}' was not found.");

        var payment = await _db.CollectorPayments.AsNoTracking()
            .FirstOrDefaultAsync(p => p.SourceType == PaymentSourceType.ExtraWaste && p.SourceId == receiptId, cancellationToken);

        // Rates and line amounts are read from the payment's SAVED snapshot only — never recalculated.
        var snapshot = PaymentSnapshotSerializer.TryDeserialize(payment?.CalculationSnapshot);
        var snapshotLines = snapshot?.ExtraWaste?.Lines ?? new List<ExtraWasteLineSnapshot>();

        var collector = await (from c in _db.Collectors.AsNoTracking()
                               join u in _db.Users.AsNoTracking() on c.UserId equals u.UserId
                               where c.CollectorId == receipt.CollectorId
                               select new { u.FullName, c.VehicleType })
            .FirstOrDefaultAsync(cancellationToken);

        var receivedByName = await _db.Users.AsNoTracking()
            .Where(u => u.UserId == receipt.ReceivedByStaffId)
            .Select(u => u.FullName)
            .FirstOrDefaultAsync(cancellationToken);

        var ordered = receipt.Items.OrderBy(i => i.CreatedAt).ThenBy(i => i.Id).ToList();

        return new ExtraWasteReceiptDetailResponse
        {
            ReceiptId = receipt.Id,
            ReceivedAt = receipt.ReceivedAt,
            Notes = receipt.Notes,
            CollectorId = receipt.CollectorId,
            CollectorName = collector?.FullName,
            CollectorVehicleType = collector?.VehicleType,
            ReceivedByStaffId = receipt.ReceivedByStaffId,
            ReceivedByName = receivedByName,
            AcceptedCount = ordered.Count(i => i.Accepted),
            RejectedCount = ordered.Count(i => !i.Accepted),
            TotalWeightKg = ordered.Sum(i => i.WeightKg),
            AcceptedWeightKg = ordered.Where(i => i.Accepted).Sum(i => i.WeightKg),
            Payment = payment is null
                ? null
                : new ReceiptPaymentSummary
                {
                    PaymentId = payment.Id, Status = payment.Status.ToString(), Amount = payment.Amount, HasSnapshot = snapshot is not null
                },
            Items = ordered.Select(i =>
            {
                var line = snapshotLines.FirstOrDefault(l => l.ReceiptItemId == i.Id);
                return new ExtraWasteReceiptLineResponse
                {
                    Id = i.Id,
                    ItemType = i.ItemType,
                    WeightKg = i.WeightKg,
                    Accepted = i.Accepted,
                    RejectionReason = i.RejectionReason,
                    InventoryItemId = i.InventoryItemId,
                    ContributesToPayment = i.Accepted && payment is not null,
                    RatePerKg = line?.RatePerKg,
                    // A rejected line is always Rs. 0 by rule; an accepted line's amount is only known from the snapshot.
                    LineAmount = i.Accepted ? line?.Amount : 0m
                };
            }).ToList()
        };
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