using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

public interface ICollectorPaymentService
{
    Task<CollectorPayment> CreatePaymentAsync(
        PaymentSourceType sourceType, Guid sourceId, Guid collectorId,
        PaymentContext context, CancellationToken cancellationToken = default);

    Task<CollectorPayment> MarkPaidAsync(Guid paymentId, CancellationToken cancellationToken = default);

    Task<PendingPaymentsResponse> GetPendingAsync(PendingPaymentsQuery query, CancellationToken cancellationToken = default);
}