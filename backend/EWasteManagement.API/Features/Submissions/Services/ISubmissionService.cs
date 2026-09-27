using EWasteManagement.Api.Dtos;

namespace EWasteManagement.Api.Services
{
    public interface ISubmissionService
    {
        Task<SubmissionResponseDto> CreateSubmissionAsync(CreateSubmissionDto dto, Guid userId, string userType, CancellationToken ct = default);
        Task<SubmissionResponseDto?> GetSubmissionByIdAsync(Guid id, CancellationToken ct = default);
        Task<List<SubmissionResponseDto>> GetAllSubmissionsAsync(CancellationToken ct = default);
        Task<List<SubmissionResponseDto>> GetSubmissionsForUserAsync(Guid userId, CancellationToken ct = default);
    }
}
