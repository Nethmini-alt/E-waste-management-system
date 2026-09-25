using EWasteManagement.API.Features.Processing.DTOs;

namespace EWasteManagement.API.Features.Processing.Services;

public interface IExtraWasteReceiptService
{
    Task<ReceiveExtraWasteResponse> ReceiveAsync(
        ReceiveExtraWasteRequest request, Guid receivedByStaffId, CancellationToken cancellationToken = default);

    /// <summary>Receipt history, newest first.</summary>
    Task<PagedResponse<ExtraWasteReceiptListItemResponse>> ListAsync(
        ExtraWasteReceiptListQuery query, CancellationToken cancellationToken = default);

    /// <summary>One receipt with every line — accepted and rejected — and what each contributed to the payment.</summary>
    Task<ExtraWasteReceiptDetailResponse> GetDetailAsync(Guid receiptId, CancellationToken cancellationToken = default);
}
