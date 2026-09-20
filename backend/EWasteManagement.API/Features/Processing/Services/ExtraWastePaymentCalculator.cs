using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

public class ExtraWastePaymentCalculator : IPaymentCalculator
{
    private readonly IRatePolicyLookupService _rates;
    public ExtraWastePaymentCalculator(IRatePolicyLookupService rates) => _rates = rates;

    public PaymentSourceType Handles => PaymentSourceType.ExtraWaste;

    public async Task<decimal> CalculateAsync(PaymentContext context, CancellationToken cancellationToken = default)
    {
        if (context.LineItems.Count == 0)
            throw new InvalidOperationException("Extra-waste payment requires at least one accepted line item.");

        decimal total = 0m;
        foreach (var line in context.LineItems)
        {
            var rate = await _rates.GetActiveRateAsync(line.ItemType, cancellationToken)
                ?? throw new KeyNotFoundException($"No active rate policy for item type '{line.ItemType}'.");
            total += line.WeightKg * rate.RatePerKg;
        }

        return Math.Round(total, 2);
    }
}