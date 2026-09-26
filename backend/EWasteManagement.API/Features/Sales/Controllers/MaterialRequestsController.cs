using System.Security.Claims;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Sales.Controllers;

[ApiController]
[Route("api/material-requests")]
public class MaterialRequestsController : ControllerBase
{
    private readonly IMaterialRequestService _service;

    public MaterialRequestsController(IMaterialRequestService service) => _service = service;

    [HttpPost]
    [Authorize(Roles = "Corporate")]
    [ProducesResponseType(typeof(MaterialRequestResponse), StatusCodes.Status201Created)]
    public async Task<ActionResult<MaterialRequestResponse>> Create(
        [FromBody] CreateMaterialRequestRequest request, CancellationToken ct)
    {
        var created = await _service.CreateAsync(GetCurrentUserId(), request, ct);
        return CreatedAtAction(nameof(GetMine), routeValues: null, value: created);
    }

    [HttpGet("mine")]
    [Authorize(Roles = "Corporate")]
    [ProducesResponseType(typeof(IReadOnlyList<MaterialRequestResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<MaterialRequestResponse>>> GetMine(CancellationToken ct)
        => Ok(await _service.GetMineAsync(GetCurrentUserId(), ct));

    [HttpGet]
    [Authorize(Roles = "Staff,Admin")]
    [ProducesResponseType(typeof(IReadOnlyList<MaterialRequestResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<MaterialRequestResponse>>> GetAll(CancellationToken ct)
        => Ok(await _service.GetAllAsync(ct));

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Roles = "Corporate")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        await _service.CancelAsync(GetCurrentUserId(), id, ct);
        return NoContent();
    }

    private Guid GetCurrentUserId()
    {
        var subject = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(subject, out var userId))
            throw new UnauthorizedAccessException("Invalid token subject.");
        return userId;
    }
}