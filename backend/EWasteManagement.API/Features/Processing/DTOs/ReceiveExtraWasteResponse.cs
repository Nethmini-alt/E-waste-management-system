namespace EWasteManagement.API.Features.Processing.DTOs;

public class ExtraWasteReceiptItemResult
{
    public string ItemType { get; set; } = string.Empty;
    public bool Accepted { get; set; }
    public string? RejectionReason { get; set; }
    public Guid? InventoryItemId { get; set; }
}

public class ReceiveExtraWasteResponse
{
    public Guid ExtraWasteReceiptId { get; set; }
    public DateTime ReceivedAt { get; set; }
    public List<ExtraWasteReceiptItemResult> Items { get; set; } = new();
}