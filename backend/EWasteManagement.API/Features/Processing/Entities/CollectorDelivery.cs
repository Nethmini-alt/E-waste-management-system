using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Entities;

// One visit by a collector bringing several completed jobs at once. Each job keeps its own inventory
// item and its own payment; the payments point here so they can be shown and paid as one total.
public class CollectorDelivery : BaseEntity
{
    public Guid CollectorId { get; set; }
    public Guid ReceivedByStaffId { get; set; }
    public DateTime ReceivedAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
}
