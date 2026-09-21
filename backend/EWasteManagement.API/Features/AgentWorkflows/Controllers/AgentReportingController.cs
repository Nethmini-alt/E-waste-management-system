using EWasteManagement.API.Features.AgentWorkflows.DTOs;
using EWasteManagement.API.Features.AgentWorkflows.Services;
using EWasteManagement.API.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.AgentWorkflows.Controllers;

/// <summary>
/// Where the agentic-ai service reports back. Machine-to-machine: no user JWT, guarded by the agent key.
/// Both endpoints are safe to call twice (the agent service retries), and never let a late or repeated
/// report undo a decision staff already made.
/// </summary>
[ApiController]
[Route("api/agent/workflows")]
[AllowAnonymous]
[AgentKey]
public class AgentReportingController : ControllerBase
{
    private readonly IAgentWorkflowService _workflows;

    public AgentReportingController(IAgentWorkflowService workflows) => _workflows = workflows;

    /// <summary>One finished agent step.</summary>
    [HttpPost("{workflowId:guid}/steps")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ReportStep(Guid workflowId, [FromBody] AgentStepReport report, CancellationToken ct)
    {
        await _workflows.RecordStepAsync(workflowId, report, ct);
        return NoContent();
    }

    /// <summary>The final outcome of a run (sent again after each revision).</summary>
    [HttpPost("{workflowId:guid}/result")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> ReportResult(Guid workflowId, [FromBody] AgentResultReport report, CancellationToken ct)
    {
        await _workflows.RecordResultAsync(workflowId, report, ct);
        return NoContent();
    }
}
