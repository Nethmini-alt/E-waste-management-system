using EWasteManagement.API.Features.Sales.DTOs;
using FluentValidation;

namespace EWasteManagement.API.Features.Sales.Validators;

public class CreateBuyerValidator : AbstractValidator<CreateBuyerRequest>
{
    public CreateBuyerValidator()
    {
        RuleFor(x => x.UserId)
            .NotEmpty().WithMessage("UserId is required.");

        RuleFor(x => x.CompanyName)
            .NotEmpty().WithMessage("Company name is required.")
            .MaximumLength(150);

        RuleFor(x => x.ContactPerson)
            .NotEmpty().WithMessage("Contact person is required.")
            .MaximumLength(100);

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Email format is invalid.")
            .MaximumLength(150);

        RuleFor(x => x.PhoneNumber)
            .MaximumLength(30)
            .When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));

        RuleFor(x => x.BuyerType)
            .Must(v => v is "Local" or "Export")
            .WithMessage("BuyerType must be 'Local' or 'Export'.");
    }
}

public class UpdateBuyerValidator : AbstractValidator<UpdateBuyerRequest>
{
    public UpdateBuyerValidator()
    {
        RuleFor(x => x.CompanyName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.ContactPerson).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(150);
        RuleFor(x => x.PhoneNumber).MaximumLength(30)
            .When(x => !string.IsNullOrWhiteSpace(x.PhoneNumber));

        RuleFor(x => x.BuyerType)
            .Must(v => v is "Local" or "Export")
            .WithMessage("BuyerType must be 'Local' or 'Export'.");

        RuleFor(x => x.Status)
            .Must(v => v is "Pending" or "Active" or "Suspended")
            .WithMessage("Status must be Pending, Active, or Suspended.");
    }
}