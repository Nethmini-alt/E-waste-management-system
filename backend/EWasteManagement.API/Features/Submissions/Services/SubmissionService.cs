using Microsoft.EntityFrameworkCore;
using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Entities;
using EWasteManagement.API.Features.AgentWorkflows.Entities;
using EWasteManagement.API.Features.AgentWorkflows.Services;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;

namespace EWasteManagement.Api.Services
{
    public class SubmissionService : ISubmissionService
    {
        private readonly ApplicationDbContext _context;
        private readonly IAgenticAiClient _agent;
        private readonly ILogger<SubmissionService> _logger;

        public SubmissionService(
            ApplicationDbContext context,
            IAgenticAiClient agent,
            ILogger<SubmissionService> logger)
        {
            _context = context;
            _agent = agent;
            _logger = logger;
        }

        public async Task<Submission> CreateSubmissionAsync(CreateSubmissionDto dto)
        {
            var submission = new Submission
            {
                UserId = dto.UserId,
                UserType = dto.UserType,
                PickupAddress = dto.PickupAddress,
                Items = dto.Items.Select(i => new SubmissionItem
                {
                    ItemName = i.ItemName,
                    Description = i.Description,
                    ImageUrl = i.ImageUrl
                }).ToList()
            };

            // The workflow row exists before the agents are called, so the reports they send back always
            // have somewhere to land.
            var workflow = new AgentWorkflow { SubmissionId = submission.Id };

            _context.Submissions.Add(submission);
            _context.AgentWorkflows.Add(workflow);
            await _context.SaveChangesAsync();

            await StartAgentWorkflowAsync(submission, workflow);

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

        public async Task<Submission?> UpdateStatusAsync(Guid id, string status)
        {
            var submission = await _context.Submissions.FindAsync(id);
            if (submission == null) return null;

            submission.Status = status;
            await _context.SaveChangesAsync();

            return submission;
        }

        /// <summary>
        /// Starts the agent workflow (POST /workflows). The agent service answers 202 straight away and reports
        /// its progress back later. If it cannot be started the submission is handed to staff instead of
        /// silently waiting for agents that never run. Never throws: the submission itself was saved.
        /// </summary>
        private async Task StartAgentWorkflowAsync(Submission submission, AgentWorkflow workflow)
        {
            try
            {
                var result = await _agent.StartWorkflowAsync(AgentPayloads.StartRequest(workflow.WorkflowId, submission));
                if (result.Success) return;

                workflow.Status = AgentWorkflowStatus.NeedsManualReview;
                workflow.FailureReason = $"The agents could not be started: {result.Message}";
                workflow.UpdatedAt = DateTime.UtcNow;
                submission.Status = "Needs_Review";
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Could not start the agent workflow for submission {SubmissionId}.", submission.Id);
            }
        }
    }
}
