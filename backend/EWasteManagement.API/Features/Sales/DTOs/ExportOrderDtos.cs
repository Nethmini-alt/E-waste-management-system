namespace EWasteManagement.API.Features.Sales.DTOs;

// ---------- Response ----------
public class ExportOrderResponse
{
    public Guid ExportOrderId { get; set; }
    public Guid BuyerId { get; set; }
    public string BuyerCompanyName { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public string DestinationCountry { get; set; } = string.Empty;
    public DateOnly ShipmentDate { get; set; }
    public decimal TotalWeightKg { get; set; }
    public decimal TotalValue { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<ExportOrderItemResponse> Items { get; set; } = new();
}

public class ExportOrderItemResponse
{
    public Guid ExportOrderItemId { get; set; }
    public Guid RecoveredMaterialId { get; set; }
    public string MaterialType { get; set; } = string.Empty;
    public decimal QuantityKg { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}

// ---------- Create ----------
public class CreateExportOrderRequest
{
    public Guid BuyerId { get; set; }
    public string DestinationCountry { get; set; } = string.Empty;
    public DateOnly ShipmentDate { get; set; }
    public string? Notes { get; set; }
    public List<CreateExportOrderItemRequest> Items { get; set; } = new();
}

public class CreateExportOrderItemRequest
{
    public Guid RecoveredMaterialId { get; set; }
    public decimal QuantityKg { get; set; }
}

// ---------- Update status ----------
public class UpdateExportOrderStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

// ---------- Filter ----------
public class ExportOrderFilter
{
    public Guid? BuyerId { get; set; }
    public string? Status { get; set; }
    public string? DestinationCountry { get; set; }
}