using EWasteManagement.API.Features.Sales.DTOs;
using FluentValidation;

namespace EWasteManagement.API.Features.Sales.Validators;

public class CreateSalesOrderValidator : AbstractValidator<CreateSalesOrderRequest>
{
    public CreateSalesOrderValidator()
    {
        RuleFor(x => x.BuyerId)
            .NotEmpty().WithMessage("Buyer is required.");

        RuleFor(x => x.Notes)
            .MaximumLength(1000);

        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("At least one item is required.")
            .Must(items => items.Count <= 50)
            .WithMessage("An order cannot have more than 50 items.");

        // Validate each item in the collection
        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.RecoveredMaterialId)
                .NotEmpty().WithMessage("Recovered material id is required.");

            item.RuleFor(i => i.QuantityKg)
                .GreaterThan(0).WithMessage("Quantity must be greater than 0.")
                .LessThanOrEqualTo(100_000).WithMessage("Quantity looks unrealistically large.");

            // Duplicate detection is done at the service layer (needs grouping)
        });
    }
}

public class UpdateSalesOrderStatusValidator : AbstractValidator<UpdateSalesOrderStatusRequest>
{
    public UpdateSalesOrderStatusValidator()
    {
        RuleFor(x => x.Status)
            .Must(v => v is "Draft" or "Confirmed" or "Completed" or "Cancelled")
            .WithMessage("Status must be Draft, Confirmed, Completed, or Cancelled.");
    }
}