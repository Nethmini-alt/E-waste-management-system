using System.Security.Claims;
using EWasteManagement.API.Features.AgentWorkflows.DTOs;
using EWasteManagement.API.Features.AgentWorkflows.Services;
using EWasteManagement.API.Features.Collection.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.AgentWorkflows.Controllers;

/// <summary>What the agents did for each submission, and the staff decision on their plan (React dashboard).</summary>
[ApiController]
[Route("api/v1/agent-workflows")]
[Authorize(Roles = "Staff,Admin")]
public class AgentWorkflowsController : ControllerBase
{
    private readonly IAgentWorkflowService _workflows;

    public AgentWorkflowsController(IAgentWorkflowService workflows) => _workflows = workflows;

    /// <summary>List workflows, newest first. Optional filter: ?status=PendingApproval.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AgentWorkflowResponse>>> GetAll(
        [FromQuery] string? status, CancellationToken ct)
        => Ok(await _workflows.GetAllAsync(status, ct));

    /// <summary>One workflow with the plan, validation, match and every agent step.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<AgentWorkflowResponse>> GetById(Guid id, CancellationToken ct)
        => Ok(await _workflows.GetByIdAsync(id, ct));

    /// <summary>Approve the plan: creates the Job and assigns the collector the Matcher recommended.</summary>
    [HttpPost("{id:guid}/approve")]
    public Task<ActionResult<AgentWorkflowResponse>> Approve(
        Guid id, [FromBody] ApproveWorkflowRequest? request, CancellationToken ct)
        => Decide(() => _workflows.ApproveAsync(id, CurrentUserId, request ?? new ApproveWorkflowRequest(), ct));

    /// <summary>Reject the plan. The reason is recorded.</summary>
    [HttpPost("{id:guid}/reject")]
    public Task<ActionResult<AgentWorkflowResponse>> Reject(
        Guid id, [FromBody] RejectWorkflowRequest request, CancellationToken ct)
        => Decide(() => _workflows.RejectAsync(id, CurrentUserId, request, ct));

    /// <summary>Send feedback back to the agents; they re-run Validator, Matcher and Planner (limited number of times).</summary>
    [HttpPost("{id:guid}/revise")]
    public Task<ActionResult<AgentWorkflowResponse>> Revise(
        Guid id, [FromBody] ReviseWorkflowRequest request, CancellationToken ct)
        => Decide(() => _workflows.ReviseAsync(id, CurrentUserId, request, ct));

    // Turns the service's "you can't do that now" failures into the right HTTP status.
    private async Task<ActionResult<AgentWorkflowResponse>> Decide(Func<Task<AgentWorkflowResponse>> action)
    {
        try
        {
            return Ok(await action());
        }
        catch (WorkflowConflictException ex)
        {
            return Conflict(new { message = ex.Message });
        }
        catch (PreferredCollectorUnavailableException ex)
        {
            return Conflict(new
            {
                message = ex.Message + " Request a revision (exclude them) or reject the plan."
            });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "Someone else just acted on this plan. Reload it and check its status." });
        }
        catch (AgentServiceUnavailableException ex)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                title = "Agent service unavailable",
                detail = ex.Message
            });
        }
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Token is missing a user id claim."));
}
