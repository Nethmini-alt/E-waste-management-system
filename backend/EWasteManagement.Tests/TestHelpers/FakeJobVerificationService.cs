using EWasteManagement.API.Features.Processing.Services;

namespace EWasteManagement.Tests.TestHelpers;

public class FakeJobVerificationService : IJobVerificationService
{
    private readonly JobVerificationResult _result;
    public FakeJobVerificationService(JobVerificationResult result) => _result = result;

    public Task<JobVerificationResult> VerifyAsync(Guid jobId, CancellationToken cancellationToken = default)
        => Task.FromResult(_result);
}