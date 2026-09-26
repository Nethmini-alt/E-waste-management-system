namespace EWasteManagement.API.Features.Processing.DTOs;

public class ReceiveJobWasteRequest
{
    public Guid JobId { get; set; }
    public Guid CollectorId { get; set; }
    public Guid WarehouseLocationId { get; set; }
    public decimal VerifiedWeightKg { get; set; }

    /// <summary>
    /// What the collected waste is, from the item-type list. Optional: when omitted, the job's
    /// submission category is used if it is on the list; otherwise the request is rejected.
    /// </summary>
    public string? ItemType { get; set; }
}

public class ReceiveJobWasteResponse
{
    public Guid InventoryItemId { get; set; }
    public Guid JobId { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public decimal VerifiedWeightKg { get; set; }
    public decimal? ReportedWeightKg { get; set; }
    public decimal? DiscrepancyKg { get; set; }
    public DateTime ReceivedAt { get; set; }
}