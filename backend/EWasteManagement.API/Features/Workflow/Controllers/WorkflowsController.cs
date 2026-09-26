using System.Security.Claims;
using EWasteManagement.API.Features.Workflow.DTOs;
using EWasteManagement.API.Features.Workflow.Entities;
using EWasteManagement.API.Features.Workflow.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Workflow.Controllers;

/// <summary>Staff/Admin-facing view into the intake chain — Section 5's "Agent
/// Integration: endpoints for starting workflows, reviewing status, human
/// approval and viewing execution summaries."</summary>
[ApiController]
[Route("api/workflows")]
public class WorkflowsController : ControllerBase
{
    private readonly IWorkflowService _workflows;
    private readonly IWorkflowOrchestrationService _orchestrator;

    public WorkflowsController(IWorkflowService workflows, IWorkflowOrchestrationService orchestrator)
    {
        _workflows = workflows;
        _orchestrator = orchestrator;
    }

    [HttpGet]
    [Authorize(Roles = "Staff,Admin")]
    public async Task<IActionResult> GetAll([FromQuery] string? status, CancellationToken ct)
    {
        var workflows = await _workflows.ListAsync(status, ct);
        return Ok(workflows.Select(ToResponse));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Staff,Admin")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var workflow = await _workflows.GetAsync(id, ct);
        if (workflow is null) return NotFound(new { message = "Workflow not found." });
        return Ok(ToResponse(workflow));
    }

    [HttpGet("{id:guid}/execution-log")]
    [Authorize(Roles = "Staff,Admin")]
    public async Task<IActionResult> GetExecutionLog(Guid id, CancellationToken ct)
    {
        var logs = await _workflows.GetExecutionLogAsync(id, ct);
        return Ok(logs.Select(l => new ExecutionLogEntryResponse
        {
            LogId = l.LogId,
            AgentName = l.AgentName,
            StepNumber = l.StepNumber,
            InputJson = l.InputJson,
            OutputJson = l.OutputJson,
            StartedAt = l.StartedAt,
            CompletedAt = l.CompletedAt,
            Succeeded = l.Succeeded,
            ErrorMessage = l.ErrorMessage,
        }));
    }

    /// <summary>Human-in-the-loop approval — resumes the chain from wherever it paused.</summary>
    [HttpPost("{id:guid}/approve")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] WorkflowApprovalDecisionRequest request, CancellationToken ct)
    {
        var workflow = await _workflows.GetAsync(id, ct);
        if (workflow is null) return NotFound(new { message = "Workflow not found." });
        if (workflow.Status != WorkflowStatus.PendingApproval)
            return BadRequest(new { message = $"Workflow is not pending approval (status: {workflow.Status})." });

        await _workflows.RecordApprovalActionAsync(id, WorkflowApprovalActionType.Approved, GetCurrentUserId(), request.Comments, ct);
        await _orchestrator.ResumeAfterApprovalAsync(id, ct);

        return Ok(new { message = "Approved — workflow resumed." });
    }

    [HttpPost("{id:guid}/reject")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] WorkflowApprovalDecisionRequest request, CancellationToken ct)
    {
        var workflow = await _workflows.GetAsync(id, ct);
        if (workflow is null) return NotFound(new { message = "Workflow not found." });
        if (workflow.Status != WorkflowStatus.PendingApproval)
            return BadRequest(new { message = $"Workflow is not pending approval (status: {workflow.Status})." });

        await _workflows.RecordApprovalActionAsync(id, WorkflowApprovalActionType.Rejected, GetCurrentUserId(), request.Comments, ct);
        await _workflows.SetStatusAsync(id, WorkflowStatus.Rejected, ct);

        return Ok(new { message = "Rejected." });
    }

    private static WorkflowResponse ToResponse(CollectionWorkflow w) => new()
    {
        WorkflowId = w.WorkflowId,
        SubmissionId = w.SubmissionId,
        Status = w.Status.ToString(),
        PlanJson = w.PlanJson,
        AnalyzerResultJson = w.AnalyzerResultJson,
        ValidatorResultJson = w.ValidatorResultJson,
        MatcherResultJson = w.MatcherResultJson,
        FinalReasoningSummary = w.FinalReasoningSummary,
        ApprovalRequired = w.ApprovalRequired,
        ResultingJobId = w.ResultingJobId,
        CreatedAt = w.CreatedAt,
        UpdatedAt = w.UpdatedAt,
        CompletedAt = w.CompletedAt,
    };

    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var id))
            throw new UnauthorizedAccessException("Invalid token subject.");
        return id;
    }
}
