using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Notifications.Entities;
using EWasteManagement.API.Features.Notifications.Services;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Exceptions;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class JobReceiptService : IJobReceiptService
{
    private readonly ApplicationDbContext _db;
    private readonly IJobVerificationService _jobVerification;
    private readonly ICollectorPaymentService _paymentService;
    private readonly IItemTypeCatalogService _itemTypes;
    private readonly INotificationService _notifications;

    public JobReceiptService(
        ApplicationDbContext db, IJobVerificationService jobVerification, ICollectorPaymentService paymentService,
        IItemTypeCatalogService itemTypes, INotificationService notifications)
    {
        _db = db;
        _jobVerification = jobVerification;
        _paymentService = paymentService;
        _itemTypes = itemTypes;
        _notifications = notifications;
    }
    
    public async Task<ReceiveJobWasteResponse> ReceiveAsync(
        ReceiveJobWasteRequest request, Guid receivedByStaffId, CancellationToken cancellationToken = default)
    {
        await EnsureLocationAndCollectorExistAsync(request.WarehouseLocationId, request.CollectorId, cancellationToken);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        var received = await ReceiveOneJobAsync(
            request.JobId, request.CollectorId, request.WarehouseLocationId, request.VerifiedWeightKg, request.ItemType,
            receivedByStaffId, deliveryId: null, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await NotifyCollectorOfReceiptAsync(request.CollectorId, 1, received.VerifiedWeightKg, received.PaymentAmount);

        return new ReceiveJobWasteResponse
        {
            InventoryItemId = received.InventoryItemId,
            JobId = received.JobId,
            ItemType = received.ItemType,
            VerifiedWeightKg = received.VerifiedWeightKg,
            ReportedWeightKg = received.ReportedWeightKg,
            DiscrepancyKg = received.DiscrepancyKg,
            ReceivedAt = received.ReceivedAt
        };
    }

    // Several completed jobs brought by one collector in one visit. Each job is received exactly as a
    // single job would be (own item, own payment, same rules); all of it succeeds or none of it does.
    public async Task<ReceiveDeliveryResponse> ReceiveDeliveryAsync(
        ReceiveDeliveryRequest request, Guid receivedByStaffId, CancellationToken cancellationToken = default)
    {
        await EnsureLocationAndCollectorExistAsync(request.WarehouseLocationId, request.CollectorId, cancellationToken);

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var delivery = new CollectorDelivery
        {
            CollectorId = request.CollectorId,
            ReceivedByStaffId = receivedByStaffId,
            Notes = string.IsNullOrWhiteSpace(request.Notes) ? null : request.Notes.Trim()
        };
        _db.CollectorDeliveries.Add(delivery);
        await _db.SaveChangesAsync(cancellationToken);

        var results = new List<DeliveryJobResult>();
        foreach (var line in request.Jobs)
        {
            var received = await ReceiveOneJobAsync(
                line.JobId, request.CollectorId, request.WarehouseLocationId, line.VerifiedWeightKg, line.ItemType,
                receivedByStaffId, delivery.Id, cancellationToken);
            results.Add(new DeliveryJobResult
            {
                JobId = received.JobId,
                InventoryItemId = received.InventoryItemId,
                ItemType = received.ItemType,
                VerifiedWeightKg = received.VerifiedWeightKg,
                ReportedWeightKg = received.ReportedWeightKg,
                DiscrepancyKg = received.DiscrepancyKg,
                PaymentId = received.PaymentId,
                PaymentAmount = received.PaymentAmount
            });
        }

        await transaction.CommitAsync(cancellationToken);
        await NotifyCollectorOfReceiptAsync(
            request.CollectorId, results.Count, results.Sum(r => r.VerifiedWeightKg), results.Sum(r => r.PaymentAmount));

        return new ReceiveDeliveryResponse
        {
            DeliveryId = delivery.Id,
            CollectorId = request.CollectorId,
            ReceivedAt = delivery.ReceivedAt,
            Jobs = results,
            TotalPendingAmount = results.Sum(r => r.PaymentAmount)
        };
    }

    // Collector bell: their load is off the vehicle and a payment is pending. Never throws — the
    // receipt is already committed.
    private async Task NotifyCollectorOfReceiptAsync(Guid collectorId, int jobCount, decimal weightKg, decimal paymentAmount)
    {
        try
        {
            var userId = await _db.Collectors
                .Where(c => c.CollectorId == collectorId)
                .Select(c => c.UserId)
                .FirstOrDefaultAsync();
            if (userId == default) return;

            await _notifications.NotifyAsync(
                userId,
                "Delivery received",
                $"The warehouse received {jobCount} job{(jobCount == 1 ? "" : "s")} ({weightKg:0.##} kg). " +
                $"Payment of Rs. {paymentAmount:N2} is pending.",
                NotificationType.Success,
                link: "/collector");
        }
        catch
        {
            // notification is advisory
        }
    }

    private async Task EnsureLocationAndCollectorExistAsync(Guid locationId, Guid collectorId, CancellationToken cancellationToken)
    {
        var locationExists = await _db.WarehouseLocations.AnyAsync(l => l.Id == locationId, cancellationToken);
        if (!locationExists)
            throw new KeyNotFoundException($"WarehouseLocation '{locationId}' was not found.");

        var collectorExists = await _db.Collectors.AnyAsync(c => c.CollectorId == collectorId, cancellationToken);
        if (!collectorExists)
            throw new KeyNotFoundException($"Collector '{collectorId}' was not found.");
    }

    private sealed record ReceivedJob(
        Guid JobId, Guid InventoryItemId, string ItemType, decimal VerifiedWeightKg, decimal? ReportedWeightKg,
        decimal? DiscrepancyKg, DateTime ReceivedAt, Guid PaymentId, decimal PaymentAmount);

    // Runs inside the caller's transaction.
    private async Task<ReceivedJob> ReceiveOneJobAsync(
        Guid jobId, Guid collectorId, Guid locationId, decimal verifiedWeightKg, string? requestedItemType,
        Guid receivedByStaffId, Guid? deliveryId, CancellationToken cancellationToken)
    {
        // App-level pre-check for the common case; the unique index from Step 3 is the
        // backstop for a genuine race between two simultaneous requests for the same job.
        var alreadyReceived = await _db.InventoryItems.AnyAsync(i => i.JobId == jobId, cancellationToken);
        if (alreadyReceived)
            throw new DuplicateJobReceiptException(jobId);

        var job = await _jobVerification.VerifyAsync(jobId, cancellationToken);
        if (!job.Found)
            throw new KeyNotFoundException($"Job '{jobId}' was not found.");
        if (!job.IsCompleted)
            throw new JobNotCompletedException(jobId);

        // The job already says who collected it. Never trust the collector id on the request, and
        // never guess one for a job that has none.
        if (job.CollectorId is null)
            throw JobCollectorMismatchException.NoCollectorAssigned(jobId);
        if (job.CollectorId.Value != collectorId)
            throw JobCollectorMismatchException.WrongCollector(jobId, collectorId);

        var itemType = await ResolveItemTypeAsync(requestedItemType, job.SubmissionId, cancellationToken);

        decimal? discrepancy = job.ReportedWeightKg.HasValue
            ? verifiedWeightKg - job.ReportedWeightKg.Value
            : null;

        var inventoryItem = new InventoryItem
        {
            OriginType = OriginType.JobCollection,
            JobId = jobId,
            ItemType = itemType,
            VerifiedWeightKg = verifiedWeightKg,
            CurrentLocationId = locationId
        };

        var note = discrepancy.HasValue
            ? $"Received from job {jobId}, collector {collectorId}. " +
              $"Reported {job.ReportedWeightKg:F2}kg vs verified {verifiedWeightKg:F2}kg (diff {discrepancy:F2}kg)."
            : $"Received from job {jobId}, collector {collectorId}. " +
              "Reported weight unavailable — pending Component B integration.";

        inventoryItem.MarkReceived(receivedByStaffId, note);

        _db.InventoryItems.Add(inventoryItem);
        await _db.SaveChangesAsync(cancellationToken);

        // The payment goes to the job's own collector (checked above) and is stamped with the
        // authenticated staff member who received the job.
        var payment = await _paymentService.CreatePaymentAsync(
            PaymentSourceType.Job,
            jobId,
            job.CollectorId.Value,
            new PaymentContext
            {
                TotalWeightKg = verifiedWeightKg,
                DistanceKm = job.DistanceKm,
                ReportedWeightKg = job.ReportedWeightKg
            },
            receivedByStaffId,
            cancellationToken,
            deliveryId);

        return new ReceivedJob(
            jobId, inventoryItem.Id, itemType, verifiedWeightKg, job.ReportedWeightKg, discrepancy,
            inventoryItem.CreatedAt, payment.Id, payment.Amount);
    }

    public async Task<IReadOnlyList<ReceivableJobResponse>> GetReceivableJobsAsync(CancellationToken cancellationToken = default)
    {
        // Filtered on the server: a job stops being offered as soon as an inventory item exists for it
        // (the same fact the receive call and its unique index rely on). Jobs without a collector
        // cannot be received, so they are not offered either.
        var jobs = await _db.Jobs.AsNoTracking()
            .Where(j => j.Status == JobStatus.Completed
                        && j.CollectorId != null
                        && !_db.InventoryItems.Any(i => i.JobId == j.JobId))
            .OrderByDescending(j => j.CompletedAt).ThenByDescending(j => j.CreatedAt)
            .ToListAsync(cancellationToken);

        var collectorIds = jobs.Select(j => j.CollectorId!.Value).Distinct().ToList();
        var collectors = await (from c in _db.Collectors.AsNoTracking()
                                join u in _db.Users.AsNoTracking() on c.UserId equals u.UserId
                                where collectorIds.Contains(c.CollectorId)
                                select new { c.CollectorId, u.FullName, c.VehicleType })
            .ToDictionaryAsync(x => x.CollectorId, cancellationToken);

        var submissionIds = jobs.Select(j => j.SubmissionId).Distinct().ToList();
        var categories = await _db.Submissions.AsNoTracking()
            .Where(s => submissionIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Category, cancellationToken);
        var allowedTypes = await _itemTypes.GetAllowedTypesAsync(cancellationToken);

        return jobs.Select(j =>
        {
            collectors.TryGetValue(j.CollectorId!.Value, out var collector);
            var category = categories.GetValueOrDefault(j.SubmissionId);
            return new ReceivableJobResponse
            {
                JobId = j.JobId,
                CollectorId = j.CollectorId.Value,
                CollectorName = collector?.FullName,
                CollectorVehicleType = collector?.VehicleType,
                PickupAddress = j.PickupAddress,
                ReportedWeightKg = j.MeasuredWeightKg,
                EstimatedDistanceKm = j.EstimatedDistanceKm,
                CompletedAt = j.CompletedAt,
                SubmissionCategory = string.IsNullOrWhiteSpace(category) ? null : category,
                SuggestedItemType = MatchAllowed(allowedTypes, category)
            };
        }).ToList();
    }

    // The type the worker picked wins. Without one, the customer's submission category is used — but only
    // when it is on the item-type list, so every job item can later be classified and priced like any other.
    private async Task<string> ResolveItemTypeAsync(string? requested, Guid? submissionId, CancellationToken cancellationToken)
    {
        if (!string.IsNullOrWhiteSpace(requested))
            return await _itemTypes.ResolveAsync(requested, cancellationToken)
                ?? throw new ArgumentException($"'{requested.Trim()}' is not a known item type. Choose a type from the item-type list.");

        var category = submissionId is null
            ? null
            : await _db.Submissions.AsNoTracking()
                .Where(s => s.Id == submissionId.Value)
                .Select(s => s.Category)
                .FirstOrDefaultAsync(cancellationToken);

        return await _itemTypes.ResolveAsync(category, cancellationToken)
            ?? throw new ArgumentException(
                "Choose the item type for this job — the submission's category doesn't match a known item type.");
    }

    private static string? MatchAllowed(IReadOnlyList<string> allowedTypes, string? category)
        => string.IsNullOrWhiteSpace(category)
            ? null
            : allowedTypes.FirstOrDefault(t => string.Equals(t, category.Trim(), StringComparison.OrdinalIgnoreCase));
}
