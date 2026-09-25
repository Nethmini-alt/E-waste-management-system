namespace EWasteManagement.API.Features.Processing.DTOs;

/// <summary>
/// One human approval/rejection recorded against an intake workflow. Read-only view of the
/// existing workflow_approval_actions data; the approve/reject actions themselves stay on
/// the workflow API.
/// </summary>
public class WorkflowApprovalEntryResponse
{
    public Guid ActionId { get; set; }
    public Guid WorkflowId { get; set; }
    /// <summary>Submitted, RevisionRequested, Approved or Rejected.</summary>
    public string ActionType { get; set; } = string.Empty;
    public Guid PerformedByUserId { get; set; }
    /// <summary>Display name only.</summary>
    public string? PerformedByName { get; set; }
    public string? Comments { get; set; }
    public DateTime PerformedAt { get; set; }
}
