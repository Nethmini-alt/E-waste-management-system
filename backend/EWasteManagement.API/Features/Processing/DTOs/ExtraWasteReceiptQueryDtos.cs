using FluentValidation;

namespace EWasteManagement.API.Features.Processing.DTOs;

// ---- GET /api/v1/inventory/extra-waste  (receipt history) ----

public class ExtraWasteReceiptListQuery
{
    public Guid? CollectorId { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class ExtraWasteReceiptListQueryValidator : AbstractValidator<ExtraWasteReceiptListQuery>
{
    public ExtraWasteReceiptListQueryValidator()
    {
        RuleFor(x => x.Page).GreaterThanOrEqualTo(1);
        RuleFor(x => x.PageSize).InclusiveBetween(1, 100);
    }
}

public class ExtraWasteReceiptListItemResponse
{
    public Guid ReceiptId { get; set; }
    public DateTime ReceivedAt { get; set; }
    public Guid CollectorId { get; set; }
    public string? CollectorName { get; set; }
    public int ItemCount { get; set; }
    public int AcceptedCount { get; set; }
    public int RejectedCount { get; set; }
    public decimal TotalWeightKg { get; set; }
    public decimal AcceptedWeightKg { get; set; }

    // Null when nothing was accepted (no payment is raised for an all-rejected receipt).
    public Guid? PaymentId { get; set; }
    public string? PaymentStatus { get; set; }
    public decimal? PaymentAmount { get; set; }
}

// ---- GET /api/v1/inventory/extra-waste/{id}  (receipt detail) ----

public class ExtraWasteReceiptDetailResponse
{
    public Guid ReceiptId { get; set; }
    public DateTime ReceivedAt { get; set; }
    public string? Notes { get; set; }

    public Guid CollectorId { get; set; }
    public string? CollectorName { get; set; }
    public string? CollectorVehicleType { get; set; }

    public Guid ReceivedByStaffId { get; set; }
    public string? ReceivedByName { get; set; }

    public int AcceptedCount { get; set; }
    public int RejectedCount { get; set; }
    public decimal TotalWeightKg { get; set; }
    public decimal AcceptedWeightKg { get; set; }

    /// <summary>Null when nothing was accepted, so no payment exists.</summary>
    public ReceiptPaymentSummary? Payment { get; set; }

    public List<ExtraWasteReceiptLineResponse> Items { get; set; } = new();
}

public class ReceiptPaymentSummary
{
    public Guid PaymentId { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public bool HasSnapshot { get; set; }
}

public class ExtraWasteReceiptLineResponse
{
    public Guid Id { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public decimal WeightKg { get; set; }
    public bool Accepted { get; set; }
    public string? RejectionReason { get; set; }
    public Guid? InventoryItemId { get; set; }

    /// <summary>True only for accepted lines of a receipt that produced a payment.</summary>
    public bool ContributesToPayment { get; set; }

    /// <summary>From the payment's saved snapshot; null when no snapshot line exists (older payments).</summary>
    public decimal? RatePerKg { get; set; }
    /// <summary>What this line contributed: its saved line amount, or 0 for rejected lines. Null when unknown.</summary>
    public decimal? LineAmount { get; set; }
}
