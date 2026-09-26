namespace EWasteManagement.API.Features.Sales.DTOs;

public class CreateMaterialRequestRequest
{
    public string MaterialType { get; set; } = string.Empty;
    public decimal QuantityKg { get; set; }
}

public class MaterialRequestResponse
{
    public Guid MaterialRequestId { get; set; }
    public Guid BuyerId { get; set; }
    public string BuyerCompanyName { get; set; } = string.Empty;
    public string MaterialType { get; set; } = string.Empty;
    public decimal QuantityKg { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid? CommercialPlanId { get; set; }
    public Guid? SalesOrderId { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}