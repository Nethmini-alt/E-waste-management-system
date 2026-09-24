using System.Security.Claims;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Sales.Controllers;

[ApiController]
[Route("api/material-pricing")]
[Authorize(Roles = "Staff,Admin")]
public class MaterialPricingController : ControllerBase
{
    private readonly IMaterialPricingService _service;

    public MaterialPricingController(IMaterialPricingService service) => _service = service;

    /// <summary>List pricing rows with optional filters.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MaterialPricingResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<MaterialPricingResponse>>> GetAll(
        [FromQuery] string? materialType,
        [FromQuery] string? status,
        CancellationToken ct)
    {
        var filter = new MaterialPricingFilter { MaterialType = materialType, Status = status };
        return Ok(await _service.GetAllAsync(filter, ct));
    }

    /// <summary>Get one pricing row by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(MaterialPricingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MaterialPricingResponse>> GetById(Guid id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    /// <summary>Create a new pricing row (always starts in Draft).</summary>
    [HttpPost]
    [ProducesResponseType(typeof(MaterialPricingResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<MaterialPricingResponse>> Create(
        [FromBody] CreateMaterialPricingRequest request,
        CancellationToken ct)
    {
        var currentUserId = GetCurrentUserId();
        var result = await _service.CreateAsync(request, currentUserId, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.PricingId }, result);
    }

    /// <summary>Update a pricing row. Approving auto-expires the previous Approved row.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(MaterialPricingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<MaterialPricingResponse>> Update(
        Guid id,
        [FromBody] UpdateMaterialPricingRequest request,
        CancellationToken ct)
        => Ok(await _service.UpdateAsync(id, request, ct));

    /// <summary>Delete a Draft pricing row. Approved rows must be Expired instead.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>
    /// Mark every Approved price whose expiry date has passed as Expired, and report how many
    /// were changed. Runs automatically on a background timer; exposed so staff can force it
    /// (and so it is testable through the API). Safe to call at any time — pricing lookups
    /// already refuse to use expired-by-date rows, so nothing depends on this having run.
    /// </summary>
    [HttpPost("expire-stale")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ExpireStale(CancellationToken ct)
    {
        var expired = await _service.ExpireStaleAsync(ct);
        return Ok(new { expired });
    }

    // ---------- Helpers ----------
    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var id))
            throw new UnauthorizedAccessException("Invalid token subject.");
        return id;
    }
}