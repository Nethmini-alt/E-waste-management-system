using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Entities;

// Every item the collector brings gets a row here — accepted or rejected — so a rejected
// item still leaves a timestamped record instead of vanishing. See Fix 1 in the final flow.
public class ExtraWasteReceiptItem : BaseEntity
{
    public Guid ExtraWasteReceiptId { get; set; }
    public ExtraWasteReceipt? ExtraWasteReceipt { get; set; }

    public string ItemType { get; set; } = string.Empty;
    public bool Accepted { get; set; }
    public string? RejectionReason { get; set; }

    // Set only when Accepted = true, once the matching InventoryItem is created.
    public Guid? InventoryItemId { get; set; }
    public InventoryItem? InventoryItem { get; set; }
}
