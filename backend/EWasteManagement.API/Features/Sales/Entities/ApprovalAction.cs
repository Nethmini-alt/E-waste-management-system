namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// Audit record of an approval workflow event. One plan can have many actions
/// (submitted, revision requested, approved/rejected).
/// </summary>
public class ApprovalAction
{
    public Guid ApprovalActionId { get; set; } = Guid.NewGuid();
    public Guid CommercialPlanId { get; set; }

    /// <summary>What happened: "Submitted", "RevisionRequested", "Approved", "Rejected".</summary>
    public ApprovalActionType ActionType { get; set; }

    /// <summary>Who triggered it (staff or admin user id).</summary>
    public Guid PerformedByUserId { get; set; }

    /// <summary>Free text — reason for revision/rejection, notes on approval.</summary>
    public string? Comments { get; set; }

    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public CommercialPlan CommercialPlan { get; set; } = null!;
}

public enum ApprovalActionType
{
    Submitted,
    RevisionRequested,
    Approved,
    Rejected
}