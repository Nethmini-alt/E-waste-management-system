using System.Security.Claims;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Features.Sales.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Sales.Controllers;

[ApiController]
[Route("api/export-orders")]
[Authorize(Roles = "Staff,Admin")]
public class ExportOrdersController : ControllerBase
{
    private readonly IExportOrderService _service;

    public ExportOrdersController(IExportOrderService service) => _service = service;

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<ExportOrderResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<ExportOrderResponse>>> GetAll(
        [FromQuery] Guid? buyerId,
        [FromQuery] string? status,
        [FromQuery] string? destinationCountry,
        CancellationToken ct)
    {
        var filter = new ExportOrderFilter
        {
            BuyerId = buyerId,
            Status = status,
            DestinationCountry = destinationCountry
        };
        return Ok(await _service.GetAllAsync(filter, ct));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(ExportOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ExportOrderResponse>> GetById(Guid id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    [ProducesResponseType(typeof(ExportOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ExportOrderResponse>> Create(
        [FromBody] CreateExportOrderRequest request,
        CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, GetCurrentUserId(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.ExportOrderId }, result);
    }

    /// <summary>
    /// Update status. Approving a PendingApproval order requires Admin role (FR-D09).
    /// </summary>
    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(ExportOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<ExportOrderResponse>> UpdateStatus(
        Guid id,
        [FromBody] UpdateExportOrderStatusRequest request,
        CancellationToken ct)
    {
        // Human-in-the-loop gate: approving an export is a high-impact action
        if (string.Equals(request.Status, "Approved", StringComparison.OrdinalIgnoreCase)
            && !User.IsInRole("Admin"))
        {
            return Forbid();
        }

        return Ok(await _service.UpdateStatusAsync(id, request, ct));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }

    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var id))
            throw new UnauthorizedAccessException("Invalid token subject.");
        return id;
    }
}