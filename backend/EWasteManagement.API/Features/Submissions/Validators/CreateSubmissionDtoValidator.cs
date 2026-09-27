using EWasteManagement.Api.Dtos;
using FluentValidation;

namespace EWasteManagement.Api.Validators
{
    // Runs automatically before SubmissionsController.CreateSubmission
    // (FluentValidation auto-validation + [ApiController]), so an invalid
    // request gets a 400 ValidationProblemDetails with one entry per field,
    // e.g. "PhoneNumber" or "Items[0].ImageUrl".
    public class CreateSubmissionDtoValidator : AbstractValidator<CreateSubmissionDto>
    {
        public const int MaxPickupAddressLength = 300;
        public const decimal MaxEstimatedWeightKg = 1000m;
        public const int MaxItems = 10;

        // Sri Lankan mobile numbers: 07XXXXXXXX or +947XXXXXXXX.
        public const string PhonePattern = @"^(07\d{8}|\+947\d{8})$";

        public CreateSubmissionDtoValidator()
        {
            RuleFor(x => x.PickupAddress)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Pickup address is required.")
                .MaximumLength(MaxPickupAddressLength)
                .WithMessage($"Pickup address must be {MaxPickupAddressLength} characters or fewer.");

            RuleFor(x => x.PhoneNumber)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("Phone number is required.")
                .Matches(PhonePattern)
                .WithMessage("Phone number must be a Sri Lankan number in the format 07XXXXXXXX or +947XXXXXXXX.");

            RuleFor(x => x.Category)
                .Must(c => SubmissionCategories.All.Contains(c))
                .WithMessage($"Category must be one of: {string.Join(", ", SubmissionCategories.All)}.");

            RuleFor(x => x.EstimatedWeight)
                .GreaterThan(0).WithMessage("Estimated weight must be greater than 0 kg.")
                .LessThanOrEqualTo(MaxEstimatedWeightKg)
                .WithMessage($"Estimated weight must be at most {MaxEstimatedWeightKg:0} kg.");

            RuleFor(x => x.Items)
                .Cascade(CascadeMode.Stop)
                .NotEmpty().WithMessage("At least one item is required.")
                .Must(items => items.Count <= MaxItems)
                .WithMessage($"A submission can have at most {MaxItems} items.");

            RuleForEach(x => x.Items).ChildRules(item =>
            {
                item.RuleFor(i => i.ItemName)
                    .NotEmpty().WithMessage("Item name is required.");

                item.RuleFor(i => i.Description)
                    .NotEmpty().WithMessage("Item description is required.");

                // Optional: only checked when provided.
                item.RuleFor(i => i.ImageUrl)
                    .Must(BeAbsoluteHttpUrl)
                    .When(i => !string.IsNullOrWhiteSpace(i.ImageUrl))
                    .WithMessage("Image URL must be an absolute http or https URL.");
            });
        }

        private static bool BeAbsoluteHttpUrl(string url) =>
            Uri.TryCreate(url, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);
    }
}
