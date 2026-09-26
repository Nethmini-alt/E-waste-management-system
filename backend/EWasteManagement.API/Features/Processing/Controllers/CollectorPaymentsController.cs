using System.Security.Claims;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Processing.Controllers;

[ApiController]
[Route("api/v1/payments")]
[Authorize(Roles = "Staff,Admin")]
public class CollectorPaymentsController : ControllerBase
{
    private readonly ICollectorPaymentService _service;
    public CollectorPaymentsController(ICollectorPaymentService service) => _service = service;

    // The acting staff member always comes from the JWT — never from the request.
    private bool TryGetStaffId(out Guid staffId) => Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out staffId);

    // Pending AND paid payments (history), with collector info. Filters: status, collectorId, sourceType.
    [HttpGet]
    public async Task<IActionResult> List([FromQuery] PaymentListQuery query, CancellationToken cancellationToken)
        => Ok(await _service.ListAsync(query, cancellationToken));

    // One payment with its saved calculation snapshot (never recalculated) and audit trail.
    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
        => Ok(await _service.GetDetailAsync(id, cancellationToken));

    [HttpGet("~/api/v1/inventory/payments/pending")]
    public async Task<IActionResult> GetPending([FromQuery] PendingPaymentsQuery query, CancellationToken cancellationToken)
        => Ok(await _service.GetPendingAsync(query, cancellationToken));

    [HttpPut("{id}/pay")]
    public async Task<IActionResult> MarkPaid(Guid id, CancellationToken cancellationToken)
    {
        if (!TryGetStaffId(out var staffId)) return Unauthorized("Could not resolve the authenticated staff member's id.");

        var payment = await _service.MarkPaidAsync(id, staffId, cancellationToken);
        return Ok(new CollectorPaymentResponse
        {
            Id = payment.Id,
            SourceType = payment.SourceType.ToString(),
            SourceId = payment.SourceId,
            CollectorId = payment.CollectorId,
            Amount = payment.Amount,
            Status = payment.Status.ToString(),
            CreatedAt = payment.CreatedAt,
            PaidAt = payment.PaidAt
        });
    }
}
