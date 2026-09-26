using EWasteManagement.API.Features.Processing.Services;
using FluentValidation;

namespace EWasteManagement.API.Features.Processing.DTOs;

public class ReceiveExtraWasteRequestValidator : AbstractValidator<ReceiveExtraWasteRequest>
{
    public ReceiveExtraWasteRequestValidator()
    {
        RuleFor(x => x.CollectorId).NotEmpty();
        RuleFor(x => x.WarehouseLocationId).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(1000);
        RuleFor(x => x.IdempotencyKey).MaximumLength(100);
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one item must be listed on the receipt.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.ItemType).NotEmpty().MaximumLength(50);
            // "GeneralCollection" is the rate key for job-collection payments, not a real item type.
            item.RuleFor(i => i.ItemType)
                .Must(t => !string.Equals((t ?? string.Empty).Trim(), JobPaymentCalculator.GeneralCollectionItemType, StringComparison.OrdinalIgnoreCase))
                .WithMessage($"'{JobPaymentCalculator.GeneralCollectionItemType}' is reserved for job-collection payments and cannot be used as an extra-waste item type.");
            item.RuleFor(i => i.WeightKg).GreaterThan(0);
            item.RuleFor(i => i.RejectionReason).MaximumLength(500);
            item.RuleFor(i => i.RejectionReason)
                .NotEmpty()
                .When(i => !i.Accepted)
                .WithMessage("A rejection reason is required for any item not accepted.");
        });
    }
}