namespace EWasteManagement.API.Features.Workflow.Entities;

/// <summary>
/// Audit record of an approval event on a CollectionWorkflow. Deliberately
/// mirrors Sales/ApprovalAction's shape so the same UI pattern and reasoning
/// apply to both — a workflow can have many actions over its life (submitted,
/// revision requested, approved, rejected).
/// </summary>
public class WorkflowApprovalAction
{
    public Guid WorkflowApprovalActionId { get; set; } = Guid.NewGuid();
    public Guid WorkflowId { get; set; }

    public WorkflowApprovalActionType ActionType { get; set; }

    /// <summary>Who triggered it (staff or admin user id).</summary>
    public Guid PerformedByUserId { get; set; }

    /// <summary>Free text — reason for revision/rejection, notes on approval.</summary>
    public string? Comments { get; set; }

    public DateTime PerformedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public CollectionWorkflow Workflow { get; set; } = null!;
}

public enum WorkflowApprovalActionType
{
    Submitted,
    RevisionRequested,
    Approved,
    Rejected
}