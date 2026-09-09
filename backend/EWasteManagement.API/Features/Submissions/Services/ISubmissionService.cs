using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Entities;

namespace EWasteManagement.Api.Services
{
    public interface ISubmissionService
    {
        Task<Submission> CreateSubmissionAsync(CreateSubmissionDto dto);
        Task<Submission?> GetSubmissionByIdAsync(Guid id);
        Task ProcessAICallbackAsync(Guid id, AIAnalysisDto aiDto);
        Task<IEnumerable<Submission>> GetAllSubmissionsAsync();
Task<Submission?> UpdateStatusAsync(Guid id, string status);
    }
}