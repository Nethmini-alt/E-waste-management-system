namespace EWasteManagement.API.Features.Processing.Services;

/// <param name="CollectorId">The collector assigned to the job (null when the job has none).</param>
public record JobVerificationResult(
    bool Found, bool IsCompleted, decimal? ReportedWeightKg, decimal? DistanceKm = null, Guid? CollectorId = null);

public interface IJobVerificationService
{
    Task<JobVerificationResult> VerifyAsync(Guid jobId, CancellationToken cancellationToken = default);
}