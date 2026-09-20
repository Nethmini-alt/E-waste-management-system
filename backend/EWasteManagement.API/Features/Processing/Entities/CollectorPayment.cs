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
}
