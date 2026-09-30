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
    public string? LastMatchingNote { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Agent-facing view of one open buyer demand line (see AgentController's
/// getOpenMaterialRequests). Deliberately carries everything the Sales agent's
/// priority tool needs — buyer type, live price and how long the request has waited —
/// so the agent can rank demand itself instead of the backend pre-ranking it.
/// </summary>
public class AgentOpenDemandDto
{
    public Guid MaterialRequestId { get; set; }
    public Guid BuyerId { get; set; }
    public string BuyerCompanyName { get; set; } = string.Empty;
    public string BuyerType { get; set; } = string.Empty;
    public string MaterialType { get; set; } = string.Empty;
    public decimal QuantityKg { get; set; }
    public string Status { get; set; } = string.Empty;
    public decimal? PricePerKg { get; set; }
    public double WaitingHours { get; set; }
    public DateTime CreatedAt { get; set; }
}