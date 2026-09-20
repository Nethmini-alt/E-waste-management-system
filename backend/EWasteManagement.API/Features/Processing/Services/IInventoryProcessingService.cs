using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

public interface IInventoryProcessingService
{
    Task<InventoryItemStatusResponse> TransitionStatusAsync(Guid inventoryItemId, InventoryStatus nextStatus, Guid staffId, string? notes, Guid? newLocationId, CancellationToken cancellationToken = default);
    Task<DismantleLogResponse> AddDismantleLogAsync(Guid inventoryItemId, AddDismantleLogRequest request, Guid staffId, CancellationToken cancellationToken = default);
    Task<ClassificationResponse> ClassifyAsync(Guid inventoryItemId, ClassifyInventoryItemRequest request, Guid staffId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProcessingLogEntryResponse>> GetHistoryAsync(Guid inventoryItemId, CancellationToken cancellationToken = default);
    Task MoveLocationAsync(Guid inventoryItemId, Guid newLocationId, Guid staffId, CancellationToken cancellationToken = default);
    Task<PagedResponse<InventoryItemListItemResponse>> ListAsync(InventoryListQuery query, CancellationToken cancellationToken = default);
    Task<InventoryItemDetailResponse> GetByIdAsync(Guid inventoryItemId, CancellationToken cancellationToken = default);
}