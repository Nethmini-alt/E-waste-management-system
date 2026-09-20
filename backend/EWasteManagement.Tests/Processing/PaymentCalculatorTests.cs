using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Services;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class FakeRatePolicyLookupService : IRatePolicyLookupService
{
    private readonly Dictionary<string, decimal> _rates;
    public FakeRatePolicyLookupService(Dictionary<string, decimal> rates) => _rates = rates;

    public Task<RatePolicy?> GetActiveRateAsync(string itemType, CancellationToken cancellationToken = default)
        => Task.FromResult(_rates.TryGetValue(itemType, out var rate)
            ? new RatePolicy { ItemType = itemType, RatePerKg = rate, IsActive = true }
            : null);
}

public class PaymentCalculatorTests
{
    [Fact]
    public async Task ExtraWasteCalculator_MultipleLineItemsAtDifferentRates_SumsCorrectly()
    {
        var rates = new FakeRatePolicyLookupService(new() { ["Laptop"] = 50m, ["Battery"] = 30m });
        var calculator = new ExtraWastePaymentCalculator(rates);

        var amount = await calculator.CalculateAsync(new PaymentContext
        {
            LineItems = new[] { new PaymentLineItem("Laptop", 2m), new PaymentLineItem("Battery", 1m) }
        });

        Assert.Equal(130.00m, amount); // 2*50 + 1*30
    }

    [Fact]
    public async Task ExtraWasteCalculator_UnknownItemType_Throws()
    {
        var calculator = new ExtraWastePaymentCalculator(new FakeRatePolicyLookupService(new()));

        await Assert.ThrowsAsync<KeyNotFoundException>(() => calculator.CalculateAsync(
            new PaymentContext { LineItems = new[] { new PaymentLineItem("Unknown", 1m) } }));
    }

    [Fact]
    public async Task JobCalculator_WithDistance_AddsBaseFeeWeightAndDistanceComponents()
    {
        var rates = new FakeRatePolicyLookupService(new() { ["GeneralCollection"] = 20m });
        var calculator = new JobPaymentCalculator(rates);

        var amount = await calculator.CalculateAsync(new PaymentContext { TotalWeightKg = 10m, DistanceKm = 5m });

        Assert.Equal(475.00m, amount); // 200 + 10*20 + 5*15
    }

    [Fact]
    public async Task JobCalculator_NoDistanceProvided_TreatsDistanceComponentAsZero()
    {
        var rates = new FakeRatePolicyLookupService(new() { ["GeneralCollection"] = 20m });
        var calculator = new JobPaymentCalculator(rates);

        var amount = await calculator.CalculateAsync(new PaymentContext { TotalWeightKg = 10m, DistanceKm = null });

        Assert.Equal(400.00m, amount); // 200 + 10*20 + 0
    }
}