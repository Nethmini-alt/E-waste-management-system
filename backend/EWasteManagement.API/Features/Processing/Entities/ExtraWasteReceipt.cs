using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Entities;

public class ExtraWasteReceipt : BaseEntity
{
    public Guid CollectorId { get; set; }
    public Guid ReceivedByStaffId { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
    public string? IdempotencyKey { get; set; }

    public ICollection<ExtraWasteReceiptItem> Items { get; set; } = new List<ExtraWasteReceiptItem>();
}
