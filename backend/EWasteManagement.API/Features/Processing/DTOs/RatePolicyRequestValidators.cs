using FluentValidation;

namespace EWasteManagement.API.Features.Processing.DTOs;

// rate_per_kg is decimal(10,2): at most 99,999,999.99 with two decimal places.
internal static class RatePolicyLimits
{
    public const decimal MaxRatePerKg = 99_999_999.99m;
}

public class CreateRatePolicyRequestValidator : AbstractValidator<CreateRatePolicyRequest>
{
    public CreateRatePolicyRequestValidator()
    {
        RuleFor(x => x.ItemType).NotEmpty().MaximumLength(50);
        RuleFor(x => x.RatePerKg).GreaterThan(0).LessThanOrEqualTo(RatePolicyLimits.MaxRatePerKg).PrecisionScale(10, 2, true);
    }
}

public class ReviseRatePolicyRequestValidator : AbstractValidator<ReviseRatePolicyRequest>
{
    public ReviseRatePolicyRequestValidator()
    {
        RuleFor(x => x.RatePerKg).GreaterThan(0).LessThanOrEqualTo(RatePolicyLimits.MaxRatePerKg).PrecisionScale(10, 2, true);
    }
}
