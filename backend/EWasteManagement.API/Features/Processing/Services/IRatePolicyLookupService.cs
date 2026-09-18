using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

public interface IRatePolicyLookupService
{
    Task<RatePolicy?> GetActiveRateAsync(string itemType, CancellationToken cancellationToken = default);
}