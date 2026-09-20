using EWasteManagement.API.Features.Processing.DTOs;

namespace EWasteManagement.API.Features.Processing.Services;

public interface IExtraWasteReceiptService
{
    Task<ReceiveExtraWasteResponse> ReceiveAsync(
        ReceiveExtraWasteRequest request, Guid receivedByStaffId, CancellationToken cancellationToken = default);
}