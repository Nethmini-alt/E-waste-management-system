using FluentValidation;

namespace EWasteManagement.API.Features.Processing.DTOs;

public class ReceiveJobWasteRequestValidator : AbstractValidator<ReceiveJobWasteRequest>
{
    public ReceiveJobWasteRequestValidator()
    {
        RuleFor(x => x.JobId).NotEmpty();
        RuleFor(x => x.CollectorId).NotEmpty();
        RuleFor(x => x.WarehouseLocationId).NotEmpty();
        RuleFor(x => x.VerifiedWeightKg).GreaterThan(0);
        RuleFor(x => x.ItemType).MaximumLength(50);
    }
}