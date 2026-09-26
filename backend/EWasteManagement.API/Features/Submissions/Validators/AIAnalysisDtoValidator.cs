using FluentValidation;
using EWasteManagement.Api.Dtos;

namespace EWasteManagement.Api.Validators
{
    public class AIAnalysisDtoValidator : AbstractValidator<AIAnalysisDto>
    {
        private static readonly string[] AllowedHazardLevels = { "Low", "Medium", "High", "Critical" };

        public AIAnalysisDtoValidator()
        {
            RuleFor(x => x.WasteCategory)
                .NotEmpty().WithMessage("Waste category is required.")
                .MaximumLength(150);

            RuleFor(x => x.EstimatedVolumeKg)
                .GreaterThanOrEqualTo(0);

            RuleFor(x => x.EstimatedValueUsd)
                .GreaterThanOrEqualTo(0);

            RuleFor(x => x.HazardLevel)
                .NotEmpty().WithMessage("HazardLevel is required.")
                .Must(h => AllowedHazardLevels.Contains(h))
                .WithMessage($"HazardLevel must be one of: {string.Join(", ", AllowedHazardLevels)}");
        }
    }
}