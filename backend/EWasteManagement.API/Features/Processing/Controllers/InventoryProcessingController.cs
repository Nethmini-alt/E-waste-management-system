using System.Security.Claims;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Processing.Controllers;

[ApiController]
[Route("api/v1/inventory")]
[Authorize(Roles = "Staff,Admin")]
public class InventoryProcessingController : ControllerBase
{
    private readonly IInventoryProcessingService _service;
    private readonly IClassificationValidationService _validationService;

    public InventoryProcessingController(IInventoryProcessingService service, IClassificationValidationService validationService)
    {
        _service = service;
        _validationService = validationService;
    }

    private bool TryGetStaffId(out Guid staffId) => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out staffId);

    [HttpPut("{id}/status")]
    public async Task<IActionResult> TransitionStatus(Guid id, [FromBody] TransitionInventoryStatusRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetStaffId(out var staffId)) return Unauthorized("Could not resolve the authenticated staff member's id.");
        return Ok(await _service.TransitionStatusAsync(id, request.NextStatus, staffId, request.Notes, request.NewLocationId, cancellationToken));
    }

    [HttpPost("{id}/dismantle-log")]
    public async Task<IActionResult> AddDismantleLog(Guid id, [FromBody] AddDismantleLogRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetStaffId(out var staffId)) return Unauthorized("Could not resolve the authenticated staff member's id.");
        return Ok(await _service.AddDismantleLogAsync(id, request, staffId, cancellationToken));
    }

    [HttpPut("{id}/classify")]
    public async Task<IActionResult> Classify(Guid id, [FromBody] ClassifyInventoryItemRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetStaffId(out var staffId)) return Unauthorized("Could not resolve the authenticated staff member's id.");
        return Ok(await _service.ClassifyAsync(id, request, staffId, cancellationToken));
    }

    [HttpGet("{id}/history")]
    public async Task<IActionResult> GetHistory(Guid id, CancellationToken cancellationToken)
        => Ok(await _service.GetHistoryAsync(id, cancellationToken));

    [HttpPut("{id}/location")]
    public async Task<IActionResult> MoveLocation(Guid id, [FromBody] MoveInventoryLocationRequest request, CancellationToken cancellationToken)
    {
        if (!TryGetStaffId(out var staffId)) return Unauthorized("Could not resolve the authenticated staff member's id.");
        await _service.MoveLocationAsync(id, request.NewLocationId, staffId, cancellationToken);
        return NoContent();
    }

    // Deliberately not staff-authenticated: this is a read-only, side-effect-free check meant
    // to be called by the internal Agentic AI Validator agent as its allow-listed tool. No
    // service-to-service secret yet — a documented, scoped-down simplification for the
    // assignment, worth one line in your security-considerations section.
    [HttpPost("{id}/validate-classification")]
    [AllowAnonymous]
    public async Task<IActionResult> ValidateClassification(Guid id, [FromBody] ValidateClassificationRequest request, CancellationToken cancellationToken)
        => Ok(await _validationService.ValidateAsync(id, request, cancellationToken));
}