namespace EWasteManagement.API.Features.Processing.Services;

public record JobVerificationResult(bool Found, bool IsCompleted, decimal? ReportedWeightKg, decimal? DistanceKm = null);

public interface IJobVerificationService
{
    Task<JobVerificationResult> VerifyAsync(Guid jobId, CancellationToken cancellationToken = default);
}