using Microsoft.EntityFrameworkCore;
using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Entities;
using EWasteManagement.API.Infrastructure.Persistence;

namespace EWasteManagement.Api.Services
{
    public class SubmissionService : ISubmissionService
    {
        private readonly ApplicationDbContext _context;
        private readonly HttpClient _httpClient;

        public SubmissionService(ApplicationDbContext context, HttpClient httpClient)
        {
            _context = context;
            _httpClient = httpClient;
        }

        public async Task<Submission> CreateSubmissionAsync(CreateSubmissionDto dto)
        {
            var submission = new Submission
            {
                UserId = dto.UserId,
                UserType = dto.UserType,
                Items = dto.Items.Select(i => new SubmissionItem
                {
                    ItemName = i.ItemName,
                    Description = i.Description,
                    ImageUrl = i.ImageUrl
                }).ToList()
            };

            _context.Submissions.Add(submission);
            await _context.SaveChangesAsync();

            _ = TriggerAIAgentAsync(submission.Id, dto.Items.FirstOrDefault()?.Description ?? "", dto.Items.Select(i => i.ImageUrl).ToList());

            return submission;
        }

        public async Task<IEnumerable<Submission>> GetAllSubmissionsAsync()
        {
            return await _context.Submissions
                .Include(s => s.Items)
                .Include(s => s.AIAnalysis)
                .OrderByDescending(s => s.CreatedAt)
                .ToListAsync();
        }

        public async Task<Submission?> GetSubmissionByIdAsync(Guid id)
        {
            return await _context.Submissions
                .Include(s => s.Items)
                .Include(s => s.AIAnalysis)
                .FirstOrDefaultAsync(s => s.Id == id);
        }

        public async Task ProcessAICallbackAsync(Guid id, AIAnalysisDto aiDto)
        {
            var submission = await _context.Submissions.FindAsync(id);
            if (submission == null) return;

            var analysis = new AIAnalysisResult
            {
                SubmissionId = id,
                WasteCategory = aiDto.WasteCategory,
                EstimatedVolumeKg = aiDto.EstimatedVolumeKg,
                EstimatedValueUsd = aiDto.EstimatedValueUsd,
                HazardLevel = aiDto.HazardLevel,
                RequiresHumanApproval = aiDto.RequiresHumanApproval
            };

            submission.Status = aiDto.RequiresHumanApproval ? "Pending_Approval" : "Approved";

            _context.AIAnalysisResults.Add(analysis);
            await _context.SaveChangesAsync();
        }

        public async Task<Submission?> UpdateStatusAsync(Guid id, string status)
        {
            var submission = await _context.Submissions.FindAsync(id);
            if (submission == null) return null;

            submission.Status = status;
            await _context.SaveChangesAsync();
            
            return submission;
        }

        private async Task TriggerAIAgentAsync(Guid submissionId, string description, List<string> imageUrls)
        {
            try
            {
                var payload = new
                {
                    submission_id = submissionId,
                    description = description,
                    image_urls = imageUrls
                };

                await _httpClient.PostAsJsonAsync("http://localhost:8000/analyze-submission", payload);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error calling AI Agent: {ex.Message}");
            }
        }
    }
}