using FluentValidation;
using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Entities;

namespace EWasteManagement.Api.Validators
{
    public class UpdateStatusDtoValidator : AbstractValidator<UpdateStatusDto>
    {
        public UpdateStatusDtoValidator()
        {
            RuleFor(x => x.Status)
                .NotEmpty().WithMessage("Status is required.")
                .Must(s => SubmissionStatuses.All.Contains(s))
                .WithMessage($"Status must be one of: {string.Join(", ", SubmissionStatuses.All)}");
        }
    }
}