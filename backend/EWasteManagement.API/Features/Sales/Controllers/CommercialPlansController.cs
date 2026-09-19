using System.Security.Claims;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Sales.Controllers;

[ApiController]
[Route("api/commercial-plans")]
public class CommercialPlansController : ControllerBase
{
    private readonly ICommercialPlanService _service;

    public CommercialPlansController(ICommercialPlanService service) => _service = service;

    // ---------- Agent-facing (internal) ----------

    /// <summary>
    /// Called by the AI agent to submit a proposed commercial plan.
    /// Uses a dedicated Agent API key (header: X-Agent-Key) instead of user JWT.
    /// </summary>
    [HttpPost]
    [AllowAnonymous]
    [ProducesResponseType(typeof(CommercialPlanResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CommercialPlanResponse>> Create(
        [FromBody] CreateCommercialPlanRequest request,
        [FromHeader(Name = "X-Agent-Key")] string? agentKey,
        CancellationToken ct)
    {
        var expectedKey = HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["Agent:ApiKey"];

        if (string.IsNullOrWhiteSpace(agentKey) || agentKey != expectedKey)
            return Unauthorized(new { message = "Invalid agent API key." });

        // The agent acts on behalf of a system user. Use the configured system user id.
        var systemUserIdStr = HttpContext.RequestServices
            .GetRequiredService<IConfiguration>()["Agent:SystemUserId"];
        if (!Guid.TryParse(systemUserIdStr, out var systemUserId))
            throw new InvalidOperationException("Agent:SystemUserId is not configured.");

        var result = await _service.CreateAsync(request, systemUserId, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.CommercialPlanId }, result);
    }

    // ---------- Staff/Admin-facing ----------

    /// <summary>List commercial plans with optional filters.</summary>
    [HttpGet]
    [Authorize(Roles = "Staff,Admin")]
    [ProducesResponseType(typeof(IReadOnlyList<CommercialPlanResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<CommercialPlanResponse>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] string? recommendedRoute,
        CancellationToken ct)
    {
        var filter = new CommercialPlanFilter { Status = status, RecommendedRoute = recommendedRoute };
        return Ok(await _service.GetAllAsync(filter, ct));
    }

    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Staff,Admin")]
    [ProducesResponseType(typeof(CommercialPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CommercialPlanResponse>> GetById(Guid id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    /// <summary>
    /// Approve, reject, or request a revision. Admin-only (FR-D09 human-in-the-loop).
    /// </summary>
    [HttpPost("{id:guid}/decide")]
    [Authorize(Roles = "Admin")]
    [ProducesResponseType(typeof(CommercialPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<CommercialPlanResponse>> Decide(
        Guid id,
        [FromBody] ApprovalDecisionRequest request,
        CancellationToken ct)
    {
        var result = await _service.DecideAsync(id, request, GetCurrentUserId(), ct);
        return Ok(result);
    }

    /// <summary>Mark an Approved plan as Executed (after the order has been created).</summary>
    [HttpPost("{id:guid}/mark-executed")]
    [Authorize(Roles = "Staff,Admin")]
    [ProducesResponseType(typeof(CommercialPlanResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<CommercialPlanResponse>> MarkExecuted(Guid id, CancellationToken ct)
        => Ok(await _service.MarkExecutedAsync(id, GetCurrentUserId(), ct));

    // ---------- Helpers ----------

    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var id))
            throw new UnauthorizedAccessException("Invalid token subject.");
        return id;
    }
}