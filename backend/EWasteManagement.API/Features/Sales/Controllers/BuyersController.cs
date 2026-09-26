using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Sales.Controllers;

[ApiController]
[Route("api/buyers")]
[Authorize(Roles = "Staff,Admin")]
public class BuyersController : ControllerBase
{
    private readonly IBuyerService _service;

    public BuyersController(IBuyerService service) => _service = service;

    /// <summary>Public buyer self-registration. Creates User (role=corporate) + Buyer profile.</summary>
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(BuyerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<BuyerResponse>> Register(
        [FromBody] RegisterBuyerRequest request,
        CancellationToken ct)
    {
        var result = await _service.RegisterBuyerAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.BuyerId }, result);
    }

    /// <summary>List all buyers (staff/admin only).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<BuyerResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<BuyerResponse>>> GetAll(CancellationToken ct)
    {
        var result = await _service.GetAllAsync(ct);
        return Ok(result);
    }

    /// <summary>Get one buyer by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(BuyerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BuyerResponse>> GetById(Guid id, CancellationToken ct)
    {
        var result = await _service.GetByIdAsync(id, ct);
        return Ok(result);
    }

    /// <summary>Create a new buyer profile linked to a Corporate user.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(BuyerResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<BuyerResponse>> Create(
        [FromBody] CreateBuyerRequest request,
        CancellationToken ct)
    {
        var result = await _service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetById), new { id = result.BuyerId }, result);
    }

    /// <summary>Update an existing buyer.</summary>
    [HttpPut("{id:guid}")]
    [ProducesResponseType(typeof(BuyerResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<BuyerResponse>> Update(
        Guid id,
        [FromBody] UpdateBuyerRequest request,
        CancellationToken ct)
    {
        var result = await _service.UpdateAsync(id, request, ct);
        return Ok(result);
    }

    /// <summary>Soft-delete a buyer.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await _service.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>List Corporate users who don't yet have a buyer profile (for staff onboarding).</summary>
    [HttpGet("available-users")]
    [ProducesResponseType(typeof(IReadOnlyList<AvailableUserResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<AvailableUserResponse>>> GetAvailableUsers(CancellationToken ct)
    {
        var result = await _service.GetAvailableUsersAsync(ct);
        return Ok(result);
    }
}