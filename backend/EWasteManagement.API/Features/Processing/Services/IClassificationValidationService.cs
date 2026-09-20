using EWasteManagement.API.Features.Processing.DTOs;

namespace EWasteManagement.API.Features.Processing.Services;

public interface IClassificationValidationService
{
    Task<ValidateClassificationResponse> ValidateAsync(Guid inventoryItemId, ValidateClassificationRequest request, CancellationToken cancellationToken = default);
}