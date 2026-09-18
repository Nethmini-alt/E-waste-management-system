using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

public class JobPaymentCalculator : IPaymentCalculator
{
    // Named constants rather than another DB-driven policy table — two numbers don't earn a
    // table of their own yet. Worth one sentence in the ADR if asked why at viva.
    private const decimal BaseCollectionFee = 200m;
    private const decimal PerKmRate = 15m;
    private const string GeneralCollectionItemType = "GeneralCollection";

    private readonly IRatePolicyLookupService _rates;
    public JobPaymentCalculator(IRatePolicyLookupService rates) => _rates = rates;

    public PaymentSourceType Handles => PaymentSourceType.Job;

    public async Task<decimal> CalculateAsync(PaymentContext context, CancellationToken cancellationToken = default)
    {
        var rate = await _rates.GetActiveRateAsync(GeneralCollectionItemType, cancellationToken)
            ?? throw new KeyNotFoundException($"No active rate policy for '{GeneralCollectionItemType}'.");

        var distanceComponent = (context.DistanceKm ?? 0m) * PerKmRate;
        return Math.Round(BaseCollectionFee + (context.TotalWeightKg * rate.RatePerKg) + distanceComponent, 2);
    }
}