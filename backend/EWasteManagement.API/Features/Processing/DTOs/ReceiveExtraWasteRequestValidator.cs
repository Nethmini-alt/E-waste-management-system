using FluentValidation;

namespace EWasteManagement.API.Features.Processing.DTOs;

public class ReceiveExtraWasteRequestValidator : AbstractValidator<ReceiveExtraWasteRequest>
{
    public ReceiveExtraWasteRequestValidator()
    {
        RuleFor(x => x.CollectorId).NotEmpty();
        RuleFor(x => x.WarehouseLocationId).NotEmpty();
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one item must be listed on the receipt.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ItemType).NotEmpty().MaximumLength(50);
            item.RuleFor(i => i.WeightKg).GreaterThan(0);
            item.RuleFor(i => i.RejectionReason)
                .NotEmpty()
                .When(i => !i.Accepted)
                .WithMessage("A rejection reason is required for any item not accepted.");
        });
    }
}