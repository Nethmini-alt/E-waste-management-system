using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

public class ExtraWastePaymentCalculator : IPaymentCalculator
{
    private readonly IRatePolicyLookupService _rates;
    public ExtraWastePaymentCalculator(IRatePolicyLookupService rates) => _rates = rates;

    public PaymentSourceType Handles => PaymentSourceType.ExtraWaste;

    public async Task<decimal> CalculateAsync(PaymentContext context, CancellationToken cancellationToken = default)
        => (await CalculateWithBreakdownAsync(context, cancellationToken)).Amount;

    public async Task<PaymentCalculationResult> CalculateWithBreakdownAsync(PaymentContext context, CancellationToken cancellationToken = default)
    {
        if (context.LineItems.Count == 0)
            throw new InvalidOperationException("Extra-waste payment requires at least one accepted line item.");

        // Only the accepted lines (context.LineItems) are priced. Rejected lines are recorded
        // in the snapshot with Rs. 0 and are never part of the total.
        decimal total = 0m;
        var lines = new List<ExtraWasteLineSnapshot>();
        foreach (var line in context.LineItems)
        {
            var rate = await _rates.GetActiveRateAsync(line.ItemType, cancellationToken)
                ?? throw new KeyNotFoundException($"No active rate policy for item type '{line.ItemType}'.");
            var lineAmount = line.WeightKg * rate.RatePerKg;
            total += lineAmount;

            lines.Add(new ExtraWasteLineSnapshot
            {
                ReceiptItemId = line.SourceItemId,
                ItemType = line.ItemType,
                WeightKg = line.WeightKg,
                Accepted = true,
                RatePerKg = rate.RatePerKg,
                Amount = lineAmount,
                IncludedInTotal = true
            });
        }

        foreach (var rejected in context.RejectedLineItems)
        {
            lines.Add(new ExtraWasteLineSnapshot
            {
                ReceiptItemId = rejected.SourceItemId,
                ItemType = rejected.ItemType,
                WeightKg = rejected.WeightKg,
                Accepted = false,
                RatePerKg = null,
                Amount = 0m,
                IncludedInTotal = false,
                RejectionReason = rejected.Reason
            });
        }

        var amount = Math.Round(total, 2);
        var snapshot = new PaymentCalculationSnapshot
        {
            SourceType = PaymentSourceType.ExtraWaste.ToString(),
            TotalAmount = amount,
            ExtraWaste = new ExtraWasteCalculationSnapshot { Lines = lines }
        };

        return new PaymentCalculationResult(amount, snapshot);
    }
}
