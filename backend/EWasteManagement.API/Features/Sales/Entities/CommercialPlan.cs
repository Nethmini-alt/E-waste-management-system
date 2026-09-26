namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// A commercial recovery plan proposed by the AI agent (Component D's Planner).
/// Immutable once approved. Not directly executable — staff must create the
/// Sales/Export order from the approved plan.
/// </summary>
public class CommercialPlan
{
    public Guid CommercialPlanId { get; set; } = Guid.NewGuid();

    /// <summary>Correlates this plan with the agent's workflow run.</summary>
    public Guid WorkflowId { get; set; }

    /// <summary>"LocalSale" or "Export".</summary>
    public CommercialRoute RecommendedRoute { get; set; }

    /// <summary>Optional — the buyer the agent recommends.</summary>
    public Guid? SelectedBuyerId { get; set; }

    /// <summary>Optional — the destination country if the route is Export.</summary>
    public string? DestinationCountry { get; set; }

    /// <summary>Snapshot of the materials being planned for, serialized as JSON.</summary>
    public string MaterialsJson { get; set; } = "[]";

    public decimal ExpectedRevenue { get; set; }
    public decimal EstimatedCosts { get; set; }
    public decimal EstimatedNetValue { get; set; }

    /// <summary>Free-text explanation from the agent of why this plan was chosen.</summary>
    public string ReasoningSummary { get; set; } = string.Empty;

    /// <summary>If true, execution is blocked until an Admin approves.</summary>
    public bool ApprovalRequired { get; set; }

    /// <summary>JSON array of strings, e.g. ["export_quota_near_limit", "low_margin"].</summary>
    public string? RiskFlags { get; set; }

    public CommercialPlanStatus Status { get; set; } = CommercialPlanStatus.PendingApproval;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public Buyer? SelectedBuyer { get; set; }
    public ICollection<ApprovalAction> ApprovalActions { get; set; } = new List<ApprovalAction>();
}

public enum CommercialRoute
{
    LocalSale,
    Export
}

public enum CommercialPlanStatus
{
    Draft,
    PendingApproval,
    Approved,
    Rejected,
    RevisionRequested,
    Executed
}