using System.Security.Claims;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Sales.Controllers;

[ApiController]
[Route("api/sales-orders")]
[Authorize(Roles = "Staff,Admin")]
public class SalesOrdersController : ControllerBase
{
    private readonly ISalesOrderService _service;

    public SalesOrdersController(ISalesOrderService service) => _service = service;

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SalesOrderResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<SalesOrderResponse>>> GetAll(
        [FromQuery] Guid? buyerId,
        [FromQuery] string? status,
        CancellationToken ct)
        => Ok(await _service.GetAllAsync(new SalesOrderFilter { BuyerId = buyerId, Status = status }, ct));

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SalesOrderResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<SalesOrderResponse>> GetById(Guid id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));

    [HttpPost]
    [ProducesResponseType(typeof(SalesOrderResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<SalesOrderResponse>> Create(
        [FromBody] CreateSalesOrderRequest request,
        CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, GetCurrentUserId(), ct);
        return CreatedAtAction(nameof(GetById), new { id = result.SalesOrderId }, result);
    }

    [HttpPut("{id:guid}/status")]
    [ProducesResponseType(typeof(SalesOrderResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<SalesOrderResponse>> UpdateStatus(
        Guid id,
        [FromBody] UpdateSalesOrderStatusRequest request,
        CancellationToken ct)
        => Ok(await _service.UpdateStatusAsync(id, request, ct));

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }

    private Guid GetCurrentUserId()
    {
        var sub = User.FindFirstValue(ClaimTypes.NameIdentifier)
                  ?? User.FindFirstValue("sub");
        if (!Guid.TryParse(sub, out var id))
            throw new UnauthorizedAccessException("Invalid token subject.");
        return id;
    }
}