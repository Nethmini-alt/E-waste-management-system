using System.Security.Claims;
using EWasteManagement.API.Features.Admin.DTOs;
using EWasteManagement.API.Features.Admin.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Admin.Controllers;

// Only an admin adds or removes staff (management and worker), and reviews their work.
[ApiController]
[Route("api/v1/admin/staff")]
[Authorize(Roles = "Admin")]
public class StaffController : ControllerBase
{
    private readonly IStaffService _service;

    public StaffController(IStaffService service) => _service = service;

    [HttpGet]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
        => Ok(await _service.ListAsync(cancellationToken));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateStaffRequest request, CancellationToken cancellationToken)
        => StatusCode(StatusCodes.Status201Created, await _service.CreateAsync(request, cancellationToken));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var adminId))
            return Unauthorized("Could not resolve the authenticated admin's id.");

        await _service.DeleteAsync(id, adminId, cancellationToken);
        return NoContent();
    }

    [HttpGet("activity")]
    public async Task<IActionResult> ActivitySummary(CancellationToken cancellationToken)
        => Ok(await _service.GetActivitySummaryAsync(cancellationToken));

    [HttpGet("{id:guid}/activity")]
    public async Task<IActionResult> RecentActivity(Guid id, [FromQuery] int take = 50, CancellationToken cancellationToken = default)
        => Ok(await _service.GetRecentActivityAsync(id, take, cancellationToken));
}
