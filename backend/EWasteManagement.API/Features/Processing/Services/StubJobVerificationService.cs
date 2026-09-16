namespace EWasteManagement.API.Features.Processing.Services;

/// <summary>
/// TEMPORARY. Component B's Job table isn't in this branch yet, so this always reports
/// "found and completed" with no reported weight, letting the job-receive path be built,
/// demoed, and tested today. Swap for a real implementation that queries
/// Features.Collection.Entities.Job the moment that table is merged — search "swap-stub".
/// </summary>
public class StubJobVerificationService : IJobVerificationService
{
    public Task<JobVerificationResult> VerifyAsync(Guid jobId, CancellationToken cancellationToken = default)
        => Task.FromResult(new JobVerificationResult(Found: true, IsCompleted: true, ReportedWeightKg: null));
}