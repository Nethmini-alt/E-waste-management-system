using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

public interface ICollectorPaymentService
{
    /// <summary>
    /// Creates a pending payment and saves the exact calculation used. <paramref name="createdByStaffId"/>
    /// must be the authenticated staff member (taken from the JWT by the caller), never request input.
    /// </summary>
    Task<CollectorPayment> CreatePaymentAsync(
        PaymentSourceType sourceType, Guid sourceId, Guid collectorId,
        PaymentContext context, Guid createdByStaffId, CancellationToken cancellationToken = default);

    /// <summary><paramref name="paidByStaffId"/> must be the authenticated staff member (from the JWT).</summary>
    Task<CollectorPayment> MarkPaidAsync(Guid paymentId, Guid paidByStaffId, CancellationToken cancellationToken = default);

    Task<PendingPaymentsResponse> GetPendingAsync(PendingPaymentsQuery query, CancellationToken cancellationToken = default);

    Task<PaymentListResponse> ListAsync(PaymentListQuery query, CancellationToken cancellationToken = default);

    /// <summary>One payment with its saved snapshot. Never recalculates.</summary>
    Task<PaymentDetailResponse> GetDetailAsync(Guid paymentId, CancellationToken cancellationToken = default);
}
