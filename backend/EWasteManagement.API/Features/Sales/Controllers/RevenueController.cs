using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Sales.Controllers;

[ApiController]
[Route("api/revenue")]
[Authorize(Roles = "Staff,Admin")]
public class RevenueController : ControllerBase
{
    private readonly IRevenueService _service;

    public RevenueController(IRevenueService service) => _service = service;

    /// <summary>List revenue transactions with optional filters.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<RevenueTransactionResponse>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyList<RevenueTransactionResponse>>> GetAll(
        [FromQuery] string? transactionType,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        CancellationToken ct)
    {
        // A plain "2026-01-01" binds as DateTime with Kind=Unspecified, which
        // Npgsql rejects for a timestamptz column (ArgumentException — that's
        // why this was already coming back as 400, not 500). Rather than
        // require every caller to remember to append T00:00:00Z, normalize
        // to UTC here: this still accepts a full ISO UTC timestamp unchanged
        // (SpecifyKind on an already-Utc value is a no-op) and now also
        // accepts a plain date.
        var filter = new RevenueFilter
        {
            TransactionType = transactionType,
            FromDate = fromDate.HasValue ? DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc) : null,
            ToDate = toDate.HasValue ? DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc) : null
        };
        return Ok(await _service.GetAllAsync(filter, ct));
    }

    /// <summary>Aggregate totals + monthly breakdown.</summary>
    [HttpGet("summary")]
    [ProducesResponseType(typeof(RevenueSummaryResponse), StatusCodes.Status200OK)]
    public async Task<ActionResult<RevenueSummaryResponse>> GetSummary(CancellationToken ct){try
    {
        return Ok(await _service.GetSummaryAsync(ct));
    }
    catch (Exception ex)
    {
        return Problem(
            title: ex.Message,
            detail: ex.ToString(),
            statusCode: StatusCodes.Status500InternalServerError);
    }}

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(RevenueTransactionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<RevenueTransactionResponse>> GetById(Guid id, CancellationToken ct)
        => Ok(await _service.GetByIdAsync(id, ct));
}