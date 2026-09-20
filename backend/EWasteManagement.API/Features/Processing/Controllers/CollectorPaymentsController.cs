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

    [HttpGet("~/api/v1/inventory/payments/pending")]
    public async Task<IActionResult> GetPending([FromQuery] PendingPaymentsQuery query, CancellationToken cancellationToken)
        => Ok(await _service.GetPendingAsync(query, cancellationToken));

    [HttpPut("{id}/pay")]
    public async Task<IActionResult> MarkPaid(Guid id, CancellationToken cancellationToken)
    {
        var payment = await _service.MarkPaidAsync(id, cancellationToken);
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