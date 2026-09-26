using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Processing.Controllers;

// Changing a rate changes what collectors are paid, so every write is Admin-only. Staff read rates
// through GET /api/v1/inventory/lookups/rate-policies.
[ApiController]
[Route("api/v1/rate-policies")]
[Authorize(Roles = "Admin")]
public class RatePoliciesController : ControllerBase
{
    private readonly IRatePolicyService _service;
    public RatePoliciesController(IRatePolicyService service) => _service = service;

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRatePolicyRequest request, CancellationToken cancellationToken)
        => StatusCode(StatusCodes.Status201Created, await _service.CreateAsync(request, cancellationToken));

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Revise(Guid id, [FromBody] ReviseRatePolicyRequest request, CancellationToken cancellationToken)
        => Ok(await _service.ReviseAsync(id, request, cancellationToken));

    [HttpPut("{id:guid}/deactivate")]
    public async Task<IActionResult> Deactivate(Guid id, CancellationToken cancellationToken)
        => Ok(await _service.DeactivateAsync(id, cancellationToken));

    [HttpPost("{id:guid}/restore")]
    public async Task<IActionResult> Restore(Guid id, CancellationToken cancellationToken)
        => Ok(await _service.RestoreAsync(id, cancellationToken));
}
