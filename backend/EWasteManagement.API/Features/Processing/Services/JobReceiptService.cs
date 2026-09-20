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

    public JobReceiptService(ApplicationDbContext db, IJobVerificationService jobVerification, ICollectorPaymentService paymentService)
    {
        _db = db;
        _jobVerification = jobVerification;
        _paymentService = paymentService;
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

        decimal? discrepancy = job.ReportedWeightKg.HasValue
            ? request.VerifiedWeightKg - job.ReportedWeightKg.Value
            : null;

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        var inventoryItem = new InventoryItem
        {
            OriginType = OriginType.JobCollection,
            JobId = request.JobId,
            ItemType = "Mixed Job Collection", // refined once sorted/classified later
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

        await _paymentService.CreatePaymentAsync(
            PaymentSourceType.Job,
            request.JobId,
            request.CollectorId,
            new PaymentContext { TotalWeightKg = request.VerifiedWeightKg, DistanceKm = job.DistanceKm },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return new ReceiveJobWasteResponse
        {
            InventoryItemId = inventoryItem.Id,
            JobId = request.JobId,
            VerifiedWeightKg = request.VerifiedWeightKg,
            ReportedWeightKg = job.ReportedWeightKg,
            DiscrepancyKg = discrepancy,
            ReceivedAt = inventoryItem.CreatedAt
        };
    }
}