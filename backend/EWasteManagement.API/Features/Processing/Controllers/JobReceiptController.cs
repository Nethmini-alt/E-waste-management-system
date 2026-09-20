using System.Security.Claims;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Processing.Controllers;

[ApiController]
[Route("api/v1/inventory/job-collection")]
[Authorize(Roles = "Staff,Admin")]
public class JobReceiptController : ControllerBase
{
    private readonly IJobReceiptService _service;

    public JobReceiptController(IJobReceiptService service) => _service = service;

    [HttpPost("receive")]
    public async Task<IActionResult> Receive(
        [FromBody] ReceiveJobWasteRequest request, CancellationToken cancellationToken)
    {
        var staffIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(staffIdClaim, out var staffId))
            return Unauthorized("Could not resolve the authenticated staff member's id from the token.");

        var result = await _service.ReceiveAsync(request, staffId, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }
}