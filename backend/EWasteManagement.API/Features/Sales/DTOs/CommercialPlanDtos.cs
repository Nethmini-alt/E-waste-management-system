namespace EWasteManagement.API.Features.Sales.DTOs;

// ---------- Response ----------
public class CommercialPlanResponse
{
    public Guid CommercialPlanId { get; set; }
    public Guid WorkflowId { get; set; }
    public string RecommendedRoute { get; set; } = string.Empty;   // "LocalSale" | "Export"
    public Guid? SelectedBuyerId { get; set; }
    public string? SelectedBuyerName { get; set; }
    public string? DestinationCountry { get; set; }
    public string MaterialsJson { get; set; } = "[]";
    public decimal ExpectedRevenue { get; set; }
    public decimal EstimatedCosts { get; set; }
    public decimal EstimatedNetValue { get; set; }
    public string ReasoningSummary { get; set; } = string.Empty;
    public bool ApprovalRequired { get; set; }
    public string? RiskFlags { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public List<ApprovalActionResponse> ApprovalActions { get; set; } = new();
}

public class ApprovalActionResponse
{
    public Guid ApprovalActionId { get; set; }
    public string ActionType { get; set; } = string.Empty;
    public Guid PerformedByUserId { get; set; }
    public string PerformedByName { get; set; } = string.Empty;
    public string? Comments { get; set; }
    public DateTime PerformedAt { get; set; }
}

// ---------- Create (called by AI agent) ----------
public class CreateCommercialPlanRequest
{
    public Guid WorkflowId { get; set; }
    public string RecommendedRoute { get; set; } = string.Empty;    // "LocalSale" | "Export"
    public Guid? SelectedBuyerId { get; set; }
    public string? DestinationCountry { get; set; }
    public string MaterialsJson { get; set; } = "[]";
    public decimal ExpectedRevenue { get; set; }
    public decimal EstimatedCosts { get; set; }
    public decimal EstimatedNetValue { get; set; }
    public string ReasoningSummary { get; set; } = string.Empty;
    public bool ApprovalRequired { get; set; } = true;
    public string? RiskFlags { get; set; }
}

// ---------- Approval decision ----------
public class ApprovalDecisionRequest
{
    public string Decision { get; set; } = string.Empty;    // "Approved" | "Rejected" | "RevisionRequested"
    public string? Comments { get; set; }
}

// ---------- Filter ----------
public class CommercialPlanFilter
{
    public string? Status { get; set; }
    public string? RecommendedRoute { get; set; }
}

public class GenerateCommercialPlanRequest
{
    public Guid? TargetBuyerId { get; set; }
    public List<string>? TargetMaterialTypes { get; set; }
    public decimal? MaxQuantityKg { get; set; }
    public string? PreferredRoute { get; set; }   // "LocalSale" | "Export"
}