using EWasteManagement.API.Features.Workflow.DTOs;
using EWasteManagement.API.Features.Workflow.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Workflow.Controllers;

/// <summary>
/// Read/write surface for the five agents (Planner, Analyzer, Validator,
/// Matcher, plus Sales continues to use its own AgentController). Same
/// X-Agent-Key pattern as Features/Sales/Controllers/AgentController.cs —
/// deliberately reusing the same "Agent:ApiKey" config value across every
/// agent, not a separate key per service.
/// </summary>
[ApiController]
[Route("api/agent")]
[AllowAnonymous]
public class WorkflowAgentController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly IWorkflowService _workflows;

    public WorkflowAgentController(IConfiguration config, IWorkflowService workflows)
    {
        _config = config;
        _workflows = workflows;
    }

    private bool IsAuthorized()
    {
        var expected = _config["Agent:ApiKey"];
        if (string.IsNullOrWhiteSpace(expected)) return true;
        if (!Request.Headers.TryGetValue("X-Agent-Key", out var provided)) return false;
        return provided == expected;
    }

    private IActionResult? Guard() =>
        IsAuthorized() ? null : Unauthorized(new { message = "Invalid agent API key." });

    // ---- Used by Planner and Analyzer ----

    [HttpGet("submissions/{submissionId:guid}")]
    public async Task<IActionResult> GetSubmission(Guid submissionId, CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        var snapshot = await _workflows.GetSubmissionSnapshotAsync(submissionId, ct);
        if (snapshot is null) return NotFound(new { message = "Submission not found." });
        return Ok(snapshot);
    }

    // ---- Written by Planner ----

    [HttpPost("workflows/{workflowId:guid}/plan")]
    public async Task<IActionResult> RecordPlan(Guid workflowId, [FromBody] PlanResultRequest request, CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        await _workflows.RecordPlanAsync(workflowId, request, ct);
        return Ok(new { workflowId });
    }

        [HttpPost("workflows/{workflowId:guid}/finalize")]
    public IActionResult RecordFinalize(Guid workflowId, [FromBody] FinalizeResultRequest request)
    {
        var guard = Guard();
        if (guard != null) return guard;

        // Note: the orchestrator itself calls RecordFinalizeAsync (it needs
        // to also pass the resultingJobId once the Job is created), so this
        // endpoint exists for symmetry with the agent's own submit_final_plan
        // tool, but the orchestrator's in-process call is authoritative for
        // Status. This just acknowledges receipt — nothing here is awaited,
        // so it isn't declared async.
        return Ok(new { workflowId });
    }

    // ---- Written by Analyzer ----

    [HttpPost("workflows/{workflowId:guid}/analyzer-result")]
    public async Task<IActionResult> RecordAnalyzerResult(Guid workflowId, [FromBody] AnalyzerResultRequest request, CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        await _workflows.RecordAnalyzerResultAsync(workflowId, request, ct);
        return Ok(new { workflowId });
    }

    // ---- Written by Validator ----

    [HttpPost("workflows/{workflowId:guid}/validator-result")]
    public async Task<IActionResult> RecordValidatorResult(Guid workflowId, [FromBody] ValidatorResultRequest request, CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        await _workflows.RecordValidatorResultAsync(workflowId, request, ct);
        return Ok(new { workflowId });
    }

    // ---- Written by Matcher ----

    [HttpPost("workflows/{workflowId:guid}/matcher-result")]
    public async Task<IActionResult> RecordMatcherResult(Guid workflowId, [FromBody] MatcherResultRequest request, CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        await _workflows.RecordMatcherResultAsync(workflowId, request, ct);
        return Ok(new { workflowId });
    }

    // ---- Read by Validator ----

    [HttpGet("business-rules")]
    public async Task<IActionResult> GetBusinessRules(CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        return Ok(await _workflows.GetBusinessRulesAsync(ct));
    }

    // ---- Written by all five agents, for observability ----

    [HttpPost("execution-logs")]
    public async Task<IActionResult> LogExecution([FromBody] ExecutionLogRequest request, CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        await _workflows.LogExecutionAsync(request, ct);
        return Ok();
    }
}
