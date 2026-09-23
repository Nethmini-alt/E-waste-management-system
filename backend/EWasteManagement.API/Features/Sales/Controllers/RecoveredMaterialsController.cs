using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Infrastructure.ExternalServices;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Sales.Controllers;

[ApiController]
[Route("api/recovered-materials")]
[Authorize(Roles = "Staff,Admin")]
public class RecoveredMaterialsController : ControllerBase
{
    private readonly IRecoveredMaterialsProvider _provider;

    public RecoveredMaterialsController(IRecoveredMaterialsProvider provider)
        => _provider = provider;

    /// <summary>All recovered materials from Component C (all statuses).</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RecoveredMaterialResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RecoveredMaterialResponse>>> GetAll(CancellationToken ct)
        => Ok(await _provider.GetAllAsync(ct));

    /// <summary>Only sellable materials (Ready + safety validated).</summary>
    [HttpGet("available")]
    [ProducesResponseType(typeof(IReadOnlyList<RecoveredMaterialResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RecoveredMaterialResponse>>> GetAvailable(CancellationToken ct)
        => Ok(await _provider.GetAvailableAsync(ct));

    /// <summary>Get one batch by id.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(RecoveredMaterialResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RecoveredMaterialResponse>> GetById(Guid id, CancellationToken ct)
    {
        var row = await _provider.GetByIdAsync(id, ct);
        if (row is null) return NotFound(new { message = $"Recovered material {id} not found." });
        return Ok(row);
    }
}