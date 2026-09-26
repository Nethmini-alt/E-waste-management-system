namespace EWasteManagement.API.Features.Processing.DTOs;

public class ReceiveExtraWasteItemRequest
{
    public string ItemType { get; set; } = string.Empty;
    public decimal WeightKg { get; set; }
    public bool Accepted { get; set; }
    public string? RejectionReason { get; set; }
}

public class ReceiveExtraWasteRequest
{
    public Guid CollectorId { get; set; }
    public Guid WarehouseLocationId { get; set; }
    public string? Notes { get; set; }
    public string? IdempotencyKey { get; set; }
    public List<ReceiveExtraWasteItemRequest> Items { get; set; } = new();
}