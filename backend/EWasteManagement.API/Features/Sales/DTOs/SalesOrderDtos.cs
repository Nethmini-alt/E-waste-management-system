namespace EWasteManagement.API.Features.Sales.DTOs;

// ---------- Response ----------
public class SalesOrderResponse
{
    public Guid SalesOrderId { get; set; }
    public Guid BuyerId { get; set; }
    public string BuyerCompanyName { get; set; } = string.Empty;
    public DateTime OrderDate { get; set; }
    public decimal TotalAmount { get; set; }
    public string Status { get; set; } = string.Empty;
    public string? Notes { get; set; }
    public Guid CreatedByUserId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<SalesOrderItemResponse> Items { get; set; } = new();
}

public class SalesOrderItemResponse
{
    public Guid SalesOrderItemId { get; set; }
    public Guid RecoveredMaterialId { get; set; }
    public string MaterialType { get; set; } = string.Empty;
    public decimal QuantityKg { get; set; }
    public decimal UnitPrice { get; set; }
    public decimal LineTotal { get; set; }
}

// ---------- Create ----------
public class CreateSalesOrderRequest
{
    public Guid BuyerId { get; set; }
    public string? Notes { get; set; }
    public List<CreateSalesOrderItemRequest> Items { get; set; } = new();
}

public class CreateSalesOrderItemRequest
{
    public Guid RecoveredMaterialId { get; set; }
    public decimal QuantityKg { get; set; }
}

// ---------- Update status ----------
public class UpdateSalesOrderStatusRequest
{
    public string Status { get; set; } = string.Empty;
}

// ---------- Filter ----------
public class SalesOrderFilter
{
    public Guid? BuyerId { get; set; }
    public string? Status { get; set; }
}