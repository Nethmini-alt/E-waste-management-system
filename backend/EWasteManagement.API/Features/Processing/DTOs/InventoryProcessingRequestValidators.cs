using FluentValidation;

namespace EWasteManagement.API.Features.Processing.DTOs;

public class TransitionInventoryStatusRequestValidator : AbstractValidator<TransitionInventoryStatusRequest>
{
    public TransitionInventoryStatusRequestValidator()
    {
        RuleFor(x => x.NextStatus).IsInEnum();
        RuleFor(x => x.Notes).MaximumLength(1000);
    }
}

public class AddDismantleLogRequestValidator : AbstractValidator<AddDismantleLogRequest>
{
    public AddDismantleLogRequestValidator()
    {
        RuleFor(x => x.Description).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.RemainingWeightKg).GreaterThanOrEqualTo(0).When(x => x.RemainingWeightKg.HasValue);

        RuleForEach(x => x.ChildItems).ChildRules(child =>
        {
            child.RuleFor(c => c.ItemType).NotEmpty().MaximumLength(50);
            child.RuleFor(c => c.WeightKg).GreaterThan(0);
        });
    }
}

public class ClassifyInventoryItemRequestValidator : AbstractValidator<ClassifyInventoryItemRequest>
{
    public ClassifyInventoryItemRequestValidator()
    {
        RuleFor(x => x.Category).IsInEnum();
        RuleFor(x => x.Source).IsInEnum();
        RuleFor(x => x.SubCategory).MaximumLength(100);
        RuleFor(x => x.ConfidenceScore).InclusiveBetween(0m, 1m).When(x => x.ConfidenceScore.HasValue);
    }
}

public class MoveInventoryLocationRequestValidator : AbstractValidator<MoveInventoryLocationRequest>
{
    public MoveInventoryLocationRequestValidator()
    {
        RuleFor(x => x.NewLocationId).NotEmpty();
    }
}

public class InventoryListQueryValidator : AbstractValidator<InventoryListQuery>
{
    public InventoryListQueryValidator()
    {
        RuleFor(x => x.Search).MaximumLength(100);
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.Category).IsInEnum();
        RuleFor(x => x.OriginType).IsInEnum();
        RuleFor(x => x.SortBy).IsInEnum();
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

public class PendingPaymentsQueryValidator : AbstractValidator<PendingPaymentsQuery>
{
    public PendingPaymentsQueryValidator()
    {
        RuleFor(x => x.SourceType).IsInEnum();
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

// SubCategory length is deliberately not checked here: the validation service already answers it
// as a structured "approved: false" result, which is the contract the AI agent tool relies on.
public class ValidateClassificationRequestValidator : AbstractValidator<ValidateClassificationRequest>
{
    public ValidateClassificationRequestValidator()
    {
        RuleFor(x => x.ProposedCategory).IsInEnum();
        RuleFor(x => x.ConfidenceScore).InclusiveBetween(0m, 1m).When(x => x.ConfidenceScore.HasValue);
    }
}
