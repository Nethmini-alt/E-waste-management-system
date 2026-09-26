using EWasteManagement.API.Features.Collection.Entities;
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

    public JobReceiptService(
        ApplicationDbContext db, IJobVerificationService jobVerification, ICollectorPaymentService paymentService,
        IItemTypeCatalogService itemTypes)
    {
        _db = db;
        _jobVerification = jobVerification;
        _paymentService = paymentService;
        _itemTypes = itemTypes;
    }
    
    public async Task<ReceiveJobWasteResponse> ReceiveAsync(
        ReceiveJobWasteRequest request, Guid receivedByStaffId, CancellationToken cancellationToken = default)
    {
        // App-level pre-check for the common case; the unique index from Step 3 is the
        // backstop for a genuine race between two simultaneous requests for the same job.
        var alreadyReceived = await _db.InventoryItems
            .AnyAsync(i => i.JobId == request.JobId, cancellationToken);
        if (alreadyReceived)
            throw new DuplicateJobReceiptException(request.JobId);

        var job = await _jobVerification.VerifyAsync(request.JobId, cancellationToken);
        if (!job.Found)
            throw new KeyNotFoundException($"Job '{request.JobId}' was not found.");
        if (!job.IsCompleted)
            throw new JobNotCompletedException(request.JobId);

        var locationExists = await _db.WarehouseLocations
            .AnyAsync(l => l.Id == request.WarehouseLocationId, cancellationToken);
        if (!locationExists)
            throw new KeyNotFoundException($"WarehouseLocation '{request.WarehouseLocationId}' was not found.");

        var collectorExists = await _db.Collectors
            .AnyAsync(c => c.CollectorId == request.CollectorId, cancellationToken);
        if (!collectorExists)
            throw new KeyNotFoundException($"Collector '{request.CollectorId}' was not found.");

        // The job already says who collected it. Never trust the collector id on the request, and
        // never guess one for a job that has none.
        if (job.CollectorId is null)
            throw JobCollectorMismatchException.NoCollectorAssigned(request.JobId);
        if (job.CollectorId.Value != request.CollectorId)
            throw JobCollectorMismatchException.WrongCollector(request.JobId, request.CollectorId);

        var itemType = await ResolveItemTypeAsync(request.ItemType, job.SubmissionId, cancellationToken);

        decimal? discrepancy = job.ReportedWeightKg.HasValue
            ? request.VerifiedWeightKg - job.ReportedWeightKg.Value
            : null;

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var inventoryItem = new InventoryItem
        {
            OriginType = OriginType.JobCollection,
            JobId = request.JobId,
            ItemType = itemType,
            VerifiedWeightKg = request.VerifiedWeightKg,
            CurrentLocationId = request.WarehouseLocationId
        };

        var note = discrepancy.HasValue
            ? $"Received from job {request.JobId}, collector {request.CollectorId}. " +
              $"Reported {job.ReportedWeightKg:F2}kg vs verified {request.VerifiedWeightKg:F2}kg (diff {discrepancy:F2}kg)."
            : $"Received from job {request.JobId}, collector {request.CollectorId}. " +
              "Reported weight unavailable — pending Component B integration.";

        inventoryItem.MarkReceived(receivedByStaffId, note);

        _db.InventoryItems.Add(inventoryItem);
        await _db.SaveChangesAsync(cancellationToken);

        // The payment goes to the job's own collector (checked above) and is stamped with the
        // authenticated staff member who received the job.
        await _paymentService.CreatePaymentAsync(
            PaymentSourceType.Job,
            request.JobId,
            job.CollectorId.Value,
            new PaymentContext
            {
                TotalWeightKg = request.VerifiedWeightKg,
                DistanceKm = job.DistanceKm,
                ReportedWeightKg = job.ReportedWeightKg
            },
            receivedByStaffId,
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return new ReceiveJobWasteResponse
        {
            InventoryItemId = inventoryItem.Id,
            JobId = request.JobId,
            ItemType = itemType,
            VerifiedWeightKg = request.VerifiedWeightKg,
            ReportedWeightKg = job.ReportedWeightKg,
            DiscrepancyKg = discrepancy,
            ReceivedAt = inventoryItem.CreatedAt
        };
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
