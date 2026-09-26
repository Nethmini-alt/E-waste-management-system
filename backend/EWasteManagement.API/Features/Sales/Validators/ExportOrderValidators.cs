using EWasteManagement.API.Features.Sales.DTOs;
using FluentValidation;

namespace EWasteManagement.API.Features.Sales.Validators;

public class CreateExportOrderValidator : AbstractValidator<CreateExportOrderRequest>
{
    // Customs / practical minimum for an export shipment
    private const decimal MinTotalWeightKg = 20m;
    private const decimal MaxTotalWeightKg = 100_000m;

    public CreateExportOrderValidator()
    {
        RuleFor(x => x.BuyerId).NotEmpty().WithMessage("Buyer is required.");

        RuleFor(x => x.DestinationCountry)
            .NotEmpty().WithMessage("Destination country is required.")
            .MaximumLength(100);

        RuleFor(x => x.ShipmentDate)
            .NotEmpty().WithMessage("Shipment date is required.")
            .Must(d => d >= DateOnly.FromDateTime(DateTime.UtcNow))
            .WithMessage("Shipment date cannot be in the past.");

        RuleFor(x => x.Notes).MaximumLength(1000);

        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("At least one item is required.")
            .Must(i => i.Count <= 50).WithMessage("An export order cannot have more than 50 items.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.RecoveredMaterialId).NotEmpty();
            item.RuleFor(i => i.QuantityKg)
                .GreaterThan(0).WithMessage("Quantity must be greater than 0.")
                .LessThanOrEqualTo(100_000);
        });

        // Total weight must exceed minimum — this is a cross-item rule
        RuleFor(x => x.Items)
            .Must(items => items.Sum(i => i.QuantityKg) >= MinTotalWeightKg)
            .WithMessage($"Total shipment weight must be at least {MinTotalWeightKg} kg for export.")
            .Must(items => items.Sum(i => i.QuantityKg) <= MaxTotalWeightKg)
            .WithMessage($"Total shipment weight cannot exceed {MaxTotalWeightKg} kg.");
    }
}

public class UpdateExportOrderStatusValidator : AbstractValidator<UpdateExportOrderStatusRequest>
{
    public UpdateExportOrderStatusValidator()
    {
        RuleFor(x => x.Status)
            .Must(v => v is "Draft" or "PendingApproval" or "Approved" or "Shipped" or "Completed" or "Cancelled")
            .WithMessage("Invalid export status.");
    }
}