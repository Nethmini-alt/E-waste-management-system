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
        PaymentContext context, CancellationToken cancellationToken = default)
    {
        var alreadyExists = await _db.CollectorPayments
            .AnyAsync(p => p.SourceType == sourceType && p.SourceId == sourceId, cancellationToken);
        if (alreadyExists)
            throw new DuplicatePaymentException(sourceType, sourceId);

        var calculator = _calculators.FirstOrDefault(c => c.Handles == sourceType)
            ?? throw new InvalidOperationException($"No payment calculator registered for {sourceType}.");

        var amount = await calculator.CalculateAsync(context, cancellationToken);

        var payment = new CollectorPayment
        {
            SourceType = sourceType,
            SourceId = sourceId,
            CollectorId = collectorId,
            Amount = amount
        };

        _db.CollectorPayments.Add(payment);
        await _db.SaveChangesAsync(cancellationToken);
        return payment;
    }

    public async Task<CollectorPayment> MarkPaidAsync(Guid paymentId, CancellationToken cancellationToken = default)
    {
        var payment = await _db.CollectorPayments.FindAsync(new object[] { paymentId }, cancellationToken)
            ?? throw new KeyNotFoundException($"CollectorPayment '{paymentId}' was not found.");

        if (payment.Status == PaymentStatus.Paid)
            throw new PaymentAlreadyPaidException(paymentId);

        payment.Status = PaymentStatus.Paid;
        payment.PaidAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
        return payment;
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
}