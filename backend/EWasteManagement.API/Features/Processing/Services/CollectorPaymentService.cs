using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Exceptions;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class CollectorPaymentService : ICollectorPaymentService
{
    private readonly ApplicationDbContext _db;
    private readonly IEnumerable<IPaymentCalculator> _calculators;

    public CollectorPaymentService(ApplicationDbContext db, IEnumerable<IPaymentCalculator> calculators)
    {
        _db = db;
        _calculators = calculators;
    }

    public async Task<CollectorPayment> CreatePaymentAsync(
        PaymentSourceType sourceType, Guid sourceId, Guid collectorId,
        PaymentContext context, Guid createdByStaffId, CancellationToken cancellationToken = default)
    {
        var alreadyExists = await _db.CollectorPayments
            .AnyAsync(p => p.SourceType == sourceType && p.SourceId == sourceId, cancellationToken);
        if (alreadyExists)
            throw new DuplicatePaymentException(sourceType, sourceId);

        var calculator = _calculators.FirstOrDefault(c => c.Handles == sourceType)
            ?? throw new InvalidOperationException($"No payment calculator registered for {sourceType}.");

        // Same calculation as before; the breakdown is stored with the payment so it never has to be
        // recomputed from whatever the rates happen to be later.
        var result = await calculator.CalculateWithBreakdownAsync(context, cancellationToken);

        var payment = new CollectorPayment
        {
            SourceType = sourceType,
            SourceId = sourceId,
            CollectorId = collectorId,
            Amount = result.Amount,
            CalculationSnapshot = PaymentSnapshotSerializer.Serialize(result.Snapshot),
            CreatedByStaffId = createdByStaffId
        };

        _db.CollectorPayments.Add(payment);
        await _db.SaveChangesAsync(cancellationToken);
        return payment;
    }

    public async Task<CollectorPayment> MarkPaidAsync(Guid paymentId, Guid paidByStaffId, CancellationToken cancellationToken = default)
    {
        var payment = await _db.CollectorPayments.FindAsync(new object[] { paymentId }, cancellationToken)
            ?? throw new KeyNotFoundException($"CollectorPayment '{paymentId}' was not found.");

        if (payment.Status == PaymentStatus.Paid)
            throw new PaymentAlreadyPaidException(paymentId);

        // Only status/date/who change — the amount and its snapshot are never touched here.
        payment.Status = PaymentStatus.Paid;
        payment.PaidAt = DateTime.UtcNow;
        payment.PaidByStaffId = paidByStaffId;
        await _db.SaveChangesAsync(cancellationToken);
        return payment;
    }

    public async Task<PaymentDetailResponse> GetDetailAsync(Guid paymentId, CancellationToken cancellationToken = default)
    {
        var payment = await _db.CollectorPayments.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == paymentId, cancellationToken)
            ?? throw new KeyNotFoundException($"CollectorPayment '{paymentId}' was not found.");

        var collector = await (from c in _db.Collectors.AsNoTracking()
                               join u in _db.Users.AsNoTracking() on c.UserId equals u.UserId
                               where c.CollectorId == payment.CollectorId
                               select new { u.FullName, c.VehicleType })
            .FirstOrDefaultAsync(cancellationToken);

        var response = new PaymentDetailResponse
        {
            Id = payment.Id,
            SourceType = payment.SourceType.ToString(),
            SourceId = payment.SourceId,
            Amount = payment.Amount,
            Status = payment.Status.ToString(),
            CreatedAt = payment.CreatedAt,
            PaidAt = payment.PaidAt,
            CollectorId = payment.CollectorId,
            CollectorName = collector?.FullName,
            CollectorVehicleType = collector?.VehicleType,
            CreatedByStaffId = payment.CreatedByStaffId,
            PaidByStaffId = payment.PaidByStaffId
        };

        // The saved snapshot only. If there isn't one (older payment) we say so — no recalculation.
        var snapshot = PaymentSnapshotSerializer.TryDeserialize(payment.CalculationSnapshot);
        response.HasSnapshot = snapshot is not null;
        response.Snapshot = snapshot;

        Guid? receiptStaffId = null;

        if (payment.SourceType == PaymentSourceType.Job)
        {
            var completedAt = await _db.Jobs.AsNoTracking()
                .Where(j => j.JobId == payment.SourceId)
                .Select(j => j.CompletedAt)
                .FirstOrDefaultAsync(cancellationToken);
            var inventoryItemId = await _db.InventoryItems.AsNoTracking()
                .Where(i => i.JobId == payment.SourceId)
                .Select(i => (Guid?)i.Id)
                .FirstOrDefaultAsync(cancellationToken);

            response.Job = new PaymentJobInfo { JobId = payment.SourceId, CompletedAt = completedAt, InventoryItemId = inventoryItemId };
        }
        else
        {
            var receipt = await _db.ExtraWasteReceipts.AsNoTracking()
                .Include(r => r.Items)
                .FirstOrDefaultAsync(r => r.Id == payment.SourceId, cancellationToken);
            if (receipt is not null)
            {
                receiptStaffId = receipt.ReceivedByStaffId;
                response.Receipt = new PaymentReceiptInfo
                {
                    ReceiptId = receipt.Id,
                    ReceivedAt = receipt.ReceivedAt,
                    Notes = receipt.Notes,
                    Items = receipt.Items
                        .OrderBy(i => i.CreatedAt).ThenBy(i => i.Id)
                        .Select(i => new ReceiptItemInfo
                        {
                            Id = i.Id, ItemType = i.ItemType, WeightKg = i.WeightKg, Accepted = i.Accepted,
                            RejectionReason = i.RejectionReason, InventoryItemId = i.InventoryItemId
                        }).ToList()
                };
            }
        }

        // Older extra-waste payments have no created_by, but the receipt was written by the same staff
        // member in the same request, so that is a fact rather than a guess. Job payments stay unknown.
        if (response.CreatedByStaffId is null && receiptStaffId.HasValue)
            response.CreatedByStaffId = receiptStaffId;

        var staffIds = new[] { response.CreatedByStaffId, response.PaidByStaffId, receiptStaffId }
            .Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToList();
        if (staffIds.Count > 0)
        {
            var names = await _db.Users.AsNoTracking()
                .Where(u => staffIds.Contains(u.UserId))
                .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);
            response.CreatedByName = response.CreatedByStaffId.HasValue ? names.GetValueOrDefault(response.CreatedByStaffId.Value) : null;
            response.PaidByName = response.PaidByStaffId.HasValue ? names.GetValueOrDefault(response.PaidByStaffId.Value) : null;
            if (response.Receipt is not null && receiptStaffId.HasValue)
                response.Receipt.ReceivedByName = names.GetValueOrDefault(receiptStaffId.Value);
        }

        return response;
    }

    public async Task<PendingPaymentsResponse> GetPendingAsync(PendingPaymentsQuery q, CancellationToken cancellationToken = default)
    {
        var query = _db.CollectorPayments.AsNoTracking().Where(p => p.Status == PaymentStatus.Pending);

        if (q.CollectorId.HasValue)
        {
            var collectorId = q.CollectorId.Value;
            query = query.Where(p => p.CollectorId == collectorId);
        }
        if (q.SourceType.HasValue)
        {
            var sourceType = q.SourceType.Value;
            query = query.Where(p => p.SourceType == sourceType);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        // Summed in memory: the SQLite provider used by the unit tests cannot aggregate decimals in SQL.
        var totalAmount = (await query.Select(p => p.Amount).ToListAsync(cancellationToken)).Sum();

        // Oldest first, so the payments that have waited longest are settled first.
        var rows = await query.OrderBy(p => p.CreatedAt).ThenBy(p => p.Id)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .ToListAsync(cancellationToken);

        return new PendingPaymentsResponse
        {
            Items = rows.Select(p => new CollectorPaymentResponse
            {
                Id = p.Id, SourceType = p.SourceType.ToString(), SourceId = p.SourceId, CollectorId = p.CollectorId,
                Amount = p.Amount, Status = p.Status.ToString(), CreatedAt = p.CreatedAt, PaidAt = p.PaidAt
            }).ToList(),
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)q.PageSize),
            TotalPendingAmount = totalAmount
        };
    }

    public async Task<PaymentListResponse> ListAsync(PaymentListQuery q, CancellationToken cancellationToken = default)
    {
        // Collector/source filters shape both the rows and the totals; the status filter only shapes the rows.
        var scoped = _db.CollectorPayments.AsNoTracking().AsQueryable();
        if (q.CollectorId.HasValue)
        {
            var collectorId = q.CollectorId.Value;
            scoped = scoped.Where(p => p.CollectorId == collectorId);
        }
        if (q.SourceType.HasValue)
        {
            var sourceType = q.SourceType.Value;
            scoped = scoped.Where(p => p.SourceType == sourceType);
        }

        // Summed in memory: the SQLite provider used by the unit tests cannot aggregate decimals in SQL.
        var totalPending = (await scoped.Where(p => p.Status == PaymentStatus.Pending)
            .Select(p => p.Amount).ToListAsync(cancellationToken)).Sum();
        var totalPaid = (await scoped.Where(p => p.Status == PaymentStatus.Paid)
            .Select(p => p.Amount).ToListAsync(cancellationToken)).Sum();

        var query = scoped;
        if (q.Status.HasValue)
        {
            var status = q.Status.Value;
            query = query.Where(p => p.Status == status);
        }

        var totalCount = await query.CountAsync(cancellationToken);

        // Pending: oldest first (longest-waiting settled first). Paid: most recently paid first.
        // Mixed: newest first.
        var ordered = q.Status switch
        {
            PaymentStatus.Pending => query.OrderBy(p => p.CreatedAt),
            PaymentStatus.Paid => query.OrderByDescending(p => p.PaidAt),
            _ => query.OrderByDescending(p => p.CreatedAt)
        };

        var rows = await ordered.ThenBy(p => p.Id)
            .Skip((q.Page - 1) * q.PageSize)
            .Take(q.PageSize)
            .ToListAsync(cancellationToken);

        // Collector display info comes from Collector -> User; payments only store the CollectorId.
        var collectorIds = rows.Select(r => r.CollectorId).Distinct().ToList();
        var collectors = await (from c in _db.Collectors.AsNoTracking()
                                join u in _db.Users.AsNoTracking() on c.UserId equals u.UserId
                                where collectorIds.Contains(c.CollectorId)
                                select new { c.CollectorId, u.FullName, c.VehicleType })
            .ToDictionaryAsync(x => x.CollectorId, cancellationToken);

        return new PaymentListResponse
        {
            Items = rows.Select(p =>
            {
                collectors.TryGetValue(p.CollectorId, out var collector);
                return new PaymentListItemResponse
                {
                    Id = p.Id, SourceType = p.SourceType.ToString(), SourceId = p.SourceId,
                    CollectorId = p.CollectorId, CollectorName = collector?.FullName, CollectorVehicleType = collector?.VehicleType,
                    Amount = p.Amount, Status = p.Status.ToString(), CreatedAt = p.CreatedAt, PaidAt = p.PaidAt
                };
            }).ToList(),
            Page = q.Page,
            PageSize = q.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)q.PageSize),
            TotalPendingAmount = totalPending,
            TotalPaidAmount = totalPaid
        };
    }
}