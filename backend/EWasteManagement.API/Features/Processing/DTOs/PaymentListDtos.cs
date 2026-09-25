using EWasteManagement.API.Features.Processing.Entities;
using FluentValidation;

namespace EWasteManagement.API.Features.Processing.DTOs;

// Lists payments of any status (Pending and Paid). The pending-only endpoint
// (GET /api/v1/inventory/payments/pending) is left untouched.
public class PaymentListQuery
{
    public PaymentStatus? Status { get; set; }
    public Guid? CollectorId { get; set; }
    public PaymentSourceType? SourceType { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class PaymentListItemResponse
{
    public Guid Id { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public Guid SourceId { get; set; }
    public Guid CollectorId { get; set; }
    public string? CollectorName { get; set; }
    public string? CollectorVehicleType { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }
}

public class PaymentListResponse : PagedResponse<PaymentListItemResponse>
{
    // Both totals respect the collector/source filters but ignore the status filter, so the
    // page header stays meaningful whichever tab is open.
    public decimal TotalPendingAmount { get; set; }
    public decimal TotalPaidAmount { get; set; }
}

public class PaymentListQueryValidator : AbstractValidator<PaymentListQuery>
{
    public PaymentListQueryValidator()
    {
        RuleFor(x => x.Status).IsInEnum();
        RuleFor(x => x.SourceType).IsInEnum();
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}
