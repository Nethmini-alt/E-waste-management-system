using EWasteManagement.API.Features.Processing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Processing.Controllers;

// Read-only companion to the existing WorkflowsController (same URL prefix, different sub-path).
// It exists because no endpoint returned the recorded approval/rejection actions. Approving and
// rejecting still happen through POST /api/workflows/{id}/approve and /reject (Admin only).
[ApiController]
[Route("api/workflows/{id:guid}/approvals")]
[Authorize(Roles = "Staff,Admin")]
public class WorkflowApprovalHistoryController : ControllerBase
{
    private readonly IWorkflowApprovalHistoryService _service;
    public WorkflowApprovalHistoryController(IWorkflowApprovalHistoryService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
        => Ok(await _service.GetAsync(id, cancellationToken));
}
