namespace EWasteManagement.API.Features.Collection.Services;

/// <summary>The collector an approved plan names can no longer take the job (unavailable, busy or gone).</summary>
public class PreferredCollectorUnavailableException : InvalidOperationException
{
    public PreferredCollectorUnavailableException(Guid collectorId)
        : base($"Collector {collectorId} is no longer available for this pickup.") { }
}
