using System.Security.Claims;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Processing.Controllers;

[ApiController]
[Route("api/v1/inventory/extra-waste")]
[Authorize(Roles = "Staff,Admin")]
public class ExtraWasteController : ControllerBase
{
    private readonly IExtraWasteReceiptService _service;

    public ExtraWasteController(IExtraWasteReceiptService service) => _service = service;

    // Receipt history, newest first.
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] ExtraWasteReceiptListQuery query, CancellationToken cancellationToken)
        => Ok(await _service.ListAsync(query, cancellationToken));

    // One receipt: accepted AND rejected lines (with reasons) and what each contributed to the payment.
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
        => Ok(await _service.GetDetailAsync(id, cancellationToken));

    [HttpPost("receive")]
    public async Task<IActionResult> Receive(
        [FromBody] ReceiveExtraWasteRequest request, CancellationToken cancellationToken)
    {
        var staffIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(staffIdClaim, out var staffId))
            return Unauthorized("Could not resolve the authenticated staff member's id from the token.");

        var result = await _service.ReceiveAsync(request, staffId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}