using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public interface IWorkflowApprovalHistoryService
{
    /// <summary>Human approval/rejection history of one intake workflow, oldest first. 404 if the workflow does not exist.</summary>
    Task<IReadOnlyList<WorkflowApprovalEntryResponse>> GetAsync(Guid workflowId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Read-only view over the existing workflow_approval_actions rows, for the Processing "Agentic Review"
/// screen. It deliberately does not go through — or change — the workflow services: approving and
/// rejecting stay on POST /api/workflows/{id}/approve|reject, and this only reads what they recorded.
/// </summary>
public class WorkflowApprovalHistoryService : IWorkflowApprovalHistoryService
{
    private readonly ApplicationDbContext _db;
    public WorkflowApprovalHistoryService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<WorkflowApprovalEntryResponse>> GetAsync(Guid workflowId, CancellationToken cancellationToken = default)
    {
        var exists = await _db.CollectionWorkflows.AsNoTracking().AnyAsync(w => w.WorkflowId == workflowId, cancellationToken);
        if (!exists)
            throw new KeyNotFoundException($"Workflow '{workflowId}' was not found.");

        var actions = await _db.WorkflowApprovalActions.AsNoTracking()
            .Where(a => a.WorkflowId == workflowId)
            .OrderBy(a => a.PerformedAt)
            .ToListAsync(cancellationToken);

        var userIds = actions.Select(a => a.PerformedByUserId).Distinct().ToList();
        var names = await _db.Users.AsNoTracking()
            .Where(u => userIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.FullName, cancellationToken);

        return actions.Select(a => new WorkflowApprovalEntryResponse
        {
            ActionId = a.WorkflowApprovalActionId,
            WorkflowId = a.WorkflowId,
            ActionType = a.ActionType.ToString(),
            PerformedByUserId = a.PerformedByUserId,
            PerformedByName = names.GetValueOrDefault(a.PerformedByUserId),
            Comments = a.Comments,
            PerformedAt = a.PerformedAt
        }).ToList();
    }
}
