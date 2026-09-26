using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class JobVerificationService : IJobVerificationService
{
    private readonly ApplicationDbContext _db;
    public JobVerificationService(ApplicationDbContext db) => _db = db;

    public async Task<JobVerificationResult> VerifyAsync(Guid jobId, CancellationToken cancellationToken = default)
    {
        var job = await _db.Jobs.AsNoTracking()
            .FirstOrDefaultAsync(j => j.JobId == jobId, cancellationToken);

        if (job is null)
            return new JobVerificationResult(Found: false, IsCompleted: false, ReportedWeightKg: null);

        return new JobVerificationResult(
            Found: true,
            IsCompleted: job.Status == JobStatus.Completed,
            ReportedWeightKg: job.MeasuredWeightKg,
            DistanceKm: job.EstimatedDistanceKm,
            CollectorId: job.CollectorId,
            SubmissionId: job.SubmissionId == Guid.Empty ? null : job.SubmissionId);
    }
}