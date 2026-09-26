namespace EWasteManagement.API.Features.Sales.Entities;

public class MaterialRequest
{
    public Guid MaterialRequestId { get; set; } = Guid.NewGuid();
    public Guid BuyerId { get; set; }
    public string MaterialType { get; set; } = string.Empty;
    public decimal QuantityKg { get; set; }
    public MaterialRequestStatus Status { get; set; } = MaterialRequestStatus.Waiting;
    public Guid? CommercialPlanId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    public Buyer Buyer { get; set; } = null!;
    public CommercialPlan? CommercialPlan { get; set; }
    public SalesOrder? SalesOrder { get; set; }
}

public enum MaterialRequestStatus
{
    Waiting,
    GeneratingPlan,
    PlanGenerated,
    PlanGenerationFailed,
    OrderPlaced,
    Fulfilled,
    Cancelled
}