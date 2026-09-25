using EWasteManagement.API.Features.Processing.DTOs;

namespace EWasteManagement.API.Features.Processing.Services;

// Read-only reference data the Processing screens need for dropdowns.
public interface IProcessingLookupService
{
    Task<IReadOnlyList<WarehouseLocationLookupResponse>> GetWarehouseLocationsAsync(CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RatePolicyLookupResponse>> GetRatePoliciesAsync(bool activeOnly, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<CollectorLookupResponse>> GetCollectorsAsync(CancellationToken cancellationToken = default);
}
