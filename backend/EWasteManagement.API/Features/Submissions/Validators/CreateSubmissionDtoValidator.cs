using FluentValidation;
using EWasteManagement.Api.Dtos;

namespace EWasteManagement.Api.Validators
{
    public class CreateSubmissionDtoValidator : AbstractValidator<CreateSubmissionDto>
    {
        // Values seen in use across the frontend: Household/Generator from
        // IndividualSubmissionPage, Cooperative from CooperativeSubmissionPage,
        // plus Corporate from the registration form's role options.
        private static readonly string[] AllowedUserTypes =
        {
            "Household", "Corporate", "Cooperative", "Generator"
        };

        public CreateSubmissionDtoValidator()
        {
            // UserId is intentionally NOT validated here — the controller
            // always overwrites it with the authenticated caller's id before
            // this DTO is used, so whatever the client sent is irrelevant.

            RuleFor(x => x.UserType)
                .NotEmpty().WithMessage("UserType is required.")
                .Must(t => AllowedUserTypes.Contains(t))
                .WithMessage($"UserType must be one of: {string.Join(", ", AllowedUserTypes)}");

            RuleFor(x => x.Category)
                .NotEmpty().WithMessage("Category is required.")
                .MaximumLength(100);

            RuleFor(x => x.EstimatedWeight)
                .GreaterThan(0).WithMessage("Estimated weight must be greater than 0.")
                .LessThanOrEqualTo(100000).WithMessage("Estimated weight looks unrealistically large.");

            RuleFor(x => x.PickupAddress)
                .NotEmpty().WithMessage("Pickup address is required.")
                .MaximumLength(300);

            RuleFor(x => x.PhoneNumber)
                .NotEmpty().WithMessage("Phone number is required.")
                .Matches(@"^[0-9+\-\s()]{7,20}$").WithMessage("Enter a valid phone number.");

            RuleFor(x => x.Items)
                .NotEmpty().WithMessage("Add at least one item.");

            RuleForEach(x => x.Items).SetValidator(new CreateSubmissionItemDtoValidator());

            // The AI assessment modal is a mandatory step in both submission
            // pages now (not a separate page you could skip past) — this is
            // the server-side enforcement of that, so nothing can post a
            // submission without it, even by calling the API directly.
            RuleFor(x => x.AssessmentAnswers)
                .NotNull().WithMessage("AI assessment answers are required.")
                .Must(a => a.Count == 4).WithMessage("All 4 AI assessment questions must be answered.");

            RuleForEach(x => x.AssessmentAnswers).SetValidator(new AssessmentAnswerDtoValidator());
        }
    }

    public class CreateSubmissionItemDtoValidator : AbstractValidator<CreateSubmissionItemDto>
    {
        public CreateSubmissionItemDtoValidator()
        {
            RuleFor(x => x.ItemName)
                .NotEmpty().WithMessage("Item name is required.")
                .MaximumLength(200);

            RuleFor(x => x.Description)
                .MaximumLength(1000);

            RuleFor(x => x.ImageUrl)
                .MaximumLength(2000);
        }
    }

    public class AssessmentAnswerDtoValidator : AbstractValidator<AssessmentAnswerDto>
    {
        private static readonly string[] AllowedAnswers = { "Yes", "No", "Unsure" };

        public AssessmentAnswerDtoValidator()
        {
            RuleFor(x => x.Question)
                .NotEmpty().WithMessage("Assessment question text is missing.");

            RuleFor(x => x.Answer)
                .NotEmpty().WithMessage("Assessment answer is required.")
                .Must(a => AllowedAnswers.Contains(a))
                .WithMessage($"Answer must be one of: {string.Join(", ", AllowedAnswers)}");
        }
    }
}