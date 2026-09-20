using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Entities;

// Append-only audit trail. Never update or delete a row here — every action gets a new entry.
public class ProcessingLog : BaseEntity
{
    public Guid InventoryItemId { get; set; }
    public InventoryItem? InventoryItem { get; set; }

    public string Action { get; set; } = string.Empty; // "Received", "Sorting", "Dismantled", "Classified", ...
    public Guid PerformedByStaffId { get; set; }
    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;
    public string? Notes { get; set; }
}
