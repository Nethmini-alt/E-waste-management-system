using EWasteManagement.API.Features.Sales.DTOs;
using FluentValidation;

namespace EWasteManagement.API.Features.Sales.Validators;

public class CreateMaterialPricingValidator : AbstractValidator<CreateMaterialPricingRequest>
{
    public CreateMaterialPricingValidator()
    {
        RuleFor(x => x.MaterialType)
            .NotEmpty().WithMessage("Material type is required.")
            .MaximumLength(100);

        RuleFor(x => x.PricePerKg)
            .GreaterThan(0).WithMessage("Price per kg must be greater than 0.")
            .LessThanOrEqualTo(1_000_000).WithMessage("Price per kg looks unrealistically high.");

        RuleFor(x => x.EffectiveDate)
            .NotEmpty().WithMessage("Effective date is required.");

        RuleFor(x => x.ExpiryDate)
            .GreaterThan(x => x.EffectiveDate)
            .When(x => x.ExpiryDate.HasValue)
            .WithMessage("Expiry date must be after effective date.");
    }
}

public class UpdateMaterialPricingValidator : AbstractValidator<UpdateMaterialPricingRequest>
{
    public UpdateMaterialPricingValidator()
    {
        RuleFor(x => x.MaterialType).NotEmpty().MaximumLength(100);
        RuleFor(x => x.PricePerKg).GreaterThan(0).LessThanOrEqualTo(1_000_000);

        RuleFor(x => x.EffectiveDate).NotEmpty();

        RuleFor(x => x.ExpiryDate)
            .GreaterThan(x => x.EffectiveDate)
            .When(x => x.ExpiryDate.HasValue)
            .WithMessage("Expiry date must be after effective date.");

        RuleFor(x => x.Status)
            .Must(v => v is "Draft" or "Approved" or "Expired")
            .WithMessage("Status must be Draft, Approved, or Expired.");
    }
}