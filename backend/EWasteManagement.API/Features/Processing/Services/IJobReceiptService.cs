using EWasteManagement.API.Features.Processing.DTOs;

namespace EWasteManagement.API.Features.Processing.Services;

public interface IJobReceiptService
{
    Task<ReceiveJobWasteResponse> ReceiveAsync(
        ReceiveJobWasteRequest request, Guid receivedByStaffId, CancellationToken cancellationToken = default);

    /// <summary>Completed jobs with an assigned collector that have not been received into inventory yet.</summary>
    Task<IReadOnlyList<ReceivableJobResponse>> GetReceivableJobsAsync(CancellationToken cancellationToken = default);
}
