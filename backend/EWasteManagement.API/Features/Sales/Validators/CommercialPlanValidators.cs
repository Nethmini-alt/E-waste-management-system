using System.Text.Json;
using EWasteManagement.API.Features.Sales.DTOs;
using FluentValidation;

namespace EWasteManagement.API.Features.Sales.Validators;

public class CreateCommercialPlanValidator : AbstractValidator<CreateCommercialPlanRequest>
{
    public CreateCommercialPlanValidator()
    {
        RuleFor(x => x.WorkflowId).NotEmpty();

        RuleFor(x => x.RecommendedRoute)
            .Must(v => v is "LocalSale" or "Export")
            .WithMessage("RecommendedRoute must be 'LocalSale' or 'Export'.");

        RuleFor(x => x.ExpectedRevenue).GreaterThanOrEqualTo(0);
        RuleFor(x => x.EstimatedCosts).GreaterThanOrEqualTo(0);

        RuleFor(x => x.ReasoningSummary)
            .NotEmpty().WithMessage("Reasoning summary is required (the plan must explain itself).")
            .MaximumLength(2000);

        RuleFor(x => x.MaterialsJson)
            .NotEmpty()
            .Must(BeValidJsonArray)
            .WithMessage("MaterialsJson must be a valid JSON array.");

        RuleFor(x => x.RiskFlags)
            .Must(BeValidJsonArrayOrEmpty)
            .When(x => !string.IsNullOrWhiteSpace(x.RiskFlags))
            .WithMessage("RiskFlags must be a valid JSON array if provided.");

        // If route is Export, destination country is required
        RuleFor(x => x.DestinationCountry)
            .NotEmpty()
            .When(x => x.RecommendedRoute == "Export")
            .WithMessage("Destination country is required for export plans.");
    }

    private static bool BeValidJsonArray(string json)
    {
        if (string.IsNullOrWhiteSpace(json)) return false;
        try
        {
            using var doc = JsonDocument.Parse(json);
            return doc.RootElement.ValueKind == JsonValueKind.Array;
        }
        catch { return false; }
    }

    private static bool BeValidJsonArrayOrEmpty(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return true;
        return BeValidJsonArray(json);
    }
}

public class ApprovalDecisionValidator : AbstractValidator<ApprovalDecisionRequest>
{
    public ApprovalDecisionValidator()
    {
        RuleFor(x => x.Decision)
            .Must(v => v is "Approved" or "Rejected" or "RevisionRequested")
            .WithMessage("Decision must be Approved, Rejected, or RevisionRequested.");

        // Rejection and revision require comments
        RuleFor(x => x.Comments)
            .NotEmpty()
            .When(x => x.Decision is "Rejected" or "RevisionRequested")
            .WithMessage("Comments are required when rejecting or requesting a revision.")
            .MaximumLength(1000);
    }
}