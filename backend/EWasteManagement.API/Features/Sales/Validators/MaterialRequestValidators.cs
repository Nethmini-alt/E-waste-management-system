using EWasteManagement.API.Features.Sales.DTOs;
using FluentValidation;

namespace EWasteManagement.API.Features.Sales.Validators;

public class CreateMaterialRequestValidator : AbstractValidator<CreateMaterialRequestRequest>
{
    public CreateMaterialRequestValidator()
    {
        RuleFor(request => request.MaterialType).NotEmpty().MaximumLength(100);
        RuleFor(request => request.QuantityKg).GreaterThan(0).LessThanOrEqualTo(1_000_000);
    }
}