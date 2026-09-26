using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Entities;

public class CollectorPayment : BaseEntity
{
    public PaymentSourceType SourceType { get; set; }
    public Guid SourceId { get; set; }   // JobId or ExtraWasteReceiptId, depending on SourceType

    public Guid CollectorId { get; set; }
    public decimal Amount { get; set; }
    public PaymentStatus Status { get; set; } = PaymentStatus.Pending;
    public DateTime? PaidAt { get; set; }

    // Immutable record of exactly how Amount was calculated, written once when the payment is
    // created (JSON of PaymentCalculationSnapshot). Never recalculated: null on payments created
    // before snapshots existed. MarkPaid must not touch it.
    public string? CalculationSnapshot { get; set; }

    // Audit: taken from the authenticated staff member's JWT, never from request input.
    // Null on payments created before audit tracking existed.
    public Guid? CreatedByStaffId { get; set; }
    public Guid? PaidByStaffId { get; set; }
}
