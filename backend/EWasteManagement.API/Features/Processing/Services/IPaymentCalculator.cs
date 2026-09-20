using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

public record PaymentLineItem(string ItemType, decimal WeightKg);

public class PaymentContext
{
    public decimal TotalWeightKg { get; init; }
    public decimal? DistanceKm { get; init; }
    public IReadOnlyList<PaymentLineItem> LineItems { get; init; } = Array.Empty<PaymentLineItem>();
}

public interface IPaymentCalculator
{
    PaymentSourceType Handles { get; }
    Task<decimal> CalculateAsync(PaymentContext context, CancellationToken cancellationToken = default);
}