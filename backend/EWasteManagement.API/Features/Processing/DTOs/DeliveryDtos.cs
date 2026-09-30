using FluentValidation;

namespace EWasteManagement.API.Features.Processing.DTOs;

// POST /api/v1/inventory/job-collection/receive-delivery
public class ReceiveDeliveryRequest
{
    public Guid CollectorId { get; set; }
    public Guid WarehouseLocationId { get; set; }
    public string? Notes { get; set; }
    public List<DeliveryJobLine> Jobs { get; set; } = new();
}

public class DeliveryJobLine
{
    public Guid JobId { get; set; }
    public decimal VerifiedWeightKg { get; set; }

    /// <summary>From the item-type list; falls back to the submission category when omitted.</summary>
    public string? ItemType { get; set; }
}

public class ReceiveDeliveryRequestValidator : AbstractValidator<ReceiveDeliveryRequest>
{
    public ReceiveDeliveryRequestValidator()
    {
        RuleFor(x => x.CollectorId).NotEmpty();
        RuleFor(x => x.WarehouseLocationId).NotEmpty();
        RuleFor(x => x.Notes).MaximumLength(1000);
        RuleFor(x => x.Jobs).NotEmpty().WithMessage("Select at least one job.");
        RuleFor(x => x.Jobs.Count).LessThanOrEqualTo(50);
        RuleFor(x => x.Jobs)
            .Must(jobs => jobs.Select(j => j.JobId).Distinct().Count() == jobs.Count)
            .WithMessage("The same job is listed more than once.");
        RuleForEach(x => x.Jobs).ChildRules(job =>
        {
            job.RuleFor(j => j.JobId).NotEmpty();
            job.RuleFor(j => j.VerifiedWeightKg).GreaterThan(0);
            job.RuleFor(j => j.ItemType).MaximumLength(50);
        });
    }
}

public class DeliveryJobResult
{
    public Guid JobId { get; set; }
    public Guid InventoryItemId { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public decimal VerifiedWeightKg { get; set; }
    public decimal? ReportedWeightKg { get; set; }
    public decimal? DiscrepancyKg { get; set; }
    public Guid PaymentId { get; set; }
    public decimal PaymentAmount { get; set; }
}

public class ReceiveDeliveryResponse
{
    public Guid DeliveryId { get; set; }
    public Guid CollectorId { get; set; }
    public DateTime ReceivedAt { get; set; }
    public List<DeliveryJobResult> Jobs { get; set; } = new();
    public decimal TotalPendingAmount { get; set; }
}

// GET /api/v1/payments/deliveries/{id}
public class DeliveryPaymentLine
{
    public Guid PaymentId { get; set; }
    public Guid JobId { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime? PaidAt { get; set; }
}

public class DeliverySummaryResponse
{
    public Guid DeliveryId { get; set; }
    public Guid CollectorId { get; set; }
    public string? CollectorName { get; set; }
    public DateTime ReceivedAt { get; set; }
    public string? ReceivedByName { get; set; }
    public string? Notes { get; set; }
    public List<DeliveryPaymentLine> Payments { get; set; } = new();
    public decimal TotalAmount { get; set; }
    public decimal PendingAmount { get; set; }
    public decimal PaidAmount { get; set; }
}
