namespace EWasteManagement.API.Features.Processing.DTOs;

public class ReceiveJobWasteRequest
{
    public Guid JobId { get; set; }
    public Guid CollectorId { get; set; }
    public Guid WarehouseLocationId { get; set; }
    public decimal VerifiedWeightKg { get; set; }
}

public class ReceiveJobWasteResponse
{
    public Guid InventoryItemId { get; set; }
    public Guid JobId { get; set; }
    public decimal VerifiedWeightKg { get; set; }
    public decimal? ReportedWeightKg { get; set; }
    public decimal? DiscrepancyKg { get; set; }
    public DateTime ReceivedAt { get; set; }
}