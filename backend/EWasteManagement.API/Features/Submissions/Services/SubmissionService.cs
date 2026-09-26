using Microsoft.EntityFrameworkCore;
using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Entities;
using EWasteManagement.API.Features.Workflow.Services;
using EWasteManagement.API.Infrastructure.Persistence;

namespace EWasteManagement.Api.Services
{
    public class SubmissionService : ISubmissionService
    {
        private readonly ApplicationDbContext _context;
        private readonly IWorkflowOrchestrationService _orchestrator;

        // NOTE: this used to also take an HttpClient (registered via
        // AddHttpClient<ISubmissionService, SubmissionService>()) purely to
        // fire a hardcoded POST to http://localhost:8000/analyze-submission —
        // the old, now-deleted top-level agent. That call is gone; this now
        // enqueues the new orchestrated chain instead (see StartAsync, which
        // just queues a workflow id and returns immediately — the actual
        // Planner -> Analyzer -> Validator -> Matcher chain runs in the
        // background, per the team's decision to keep submission creation fast).
        // Program.cs's registration for ISubmissionService needs to change
        // from AddHttpClient to AddScoped accordingly — see the note in slice 3.
        public SubmissionService(ApplicationDbContext context, IWorkflowOrchestrationService orchestrator)
        {
            _context = context;
            _orchestrator = orchestrator;
        }

        public async Task<Submission> CreateSubmissionAsync(CreateSubmissionDto dto)
        {
            var submission = new Submission
            {
                UserId = dto.UserId,
                UserType = dto.UserType,
                Status = SubmissionStatuses.PendingAiAnalysis,
                Category = dto.Category,
                EstimatedWeight = dto.EstimatedWeight,
                PickupAddress = dto.PickupAddress,
                PhoneNumber = dto.PhoneNumber,
                Items = dto.Items.Select(i => new SubmissionItem
                {
                    ItemName = i.ItemName,
                    Description = i.Description,
                    ImageUrl = i.ImageUrl
                }).ToList()
            };

            _context.Submissions.Add(submission);
            await _context.SaveChangesAsync();

            // Enqueue-and-return: this does not await the chain. It creates
            // the CollectionWorkflow row and hands its id to the background
            // queue, then returns immediately — see WorkflowOrchestrationService
            // and WorkflowQueueProcessor for what runs after this.
            await _orchestrator.StartAsync(submission.Id);

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

        public async Task<IEnumerable<Submission>> GetSubmissionsByUserIdAsync(Guid userId)
        {
            // Used for customers viewing only their own submissions — filters
            // at the database level rather than fetching everyone's rows and
            // discarding most of them in memory.
            return await _context.Submissions
                .Include(s => s.Items)
                .Include(s => s.AIAnalysis)
                .Where(s => s.UserId == userId)
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
            // Kept for backward compatibility (e.g. manual/admin correction
            // tools that still write an AIAnalysisResult directly) but no
            // longer called by the create-submission path — the orchestrated
            // chain now owns that via CollectionWorkflow/AgentExecutionLog
            // instead of this table. Authorization for this endpoint (staff/
            // admin only) is enforced in the controller.
            var submission = await _context.Submissions.FindAsync(id);
            if (submission == null) return;

            decimal exchangeRate = 300.0m;
            decimal estimatedValueLkr = aiDto.EstimatedValueUsd * exchangeRate;

            bool needsHumanApproval = aiDto.RequiresHumanApproval
                              || estimatedValueLkr > 15000m
                              || aiDto.EstimatedVolumeKg > 5.0m
                              || aiDto.HazardLevel == "High";

            var analysis = new AIAnalysisResult
            {
                SubmissionId = id,
                WasteCategory = aiDto.WasteCategory,
                EstimatedVolumeKg = aiDto.EstimatedVolumeKg,
                EstimatedValueUsd = aiDto.EstimatedValueUsd,
                HazardLevel = aiDto.HazardLevel,
                RequiresHumanApproval = needsHumanApproval
            };

            submission.Status = needsHumanApproval ? SubmissionStatuses.PendingApproval : SubmissionStatuses.Approved;

            _context.AIAnalysisResults.Add(analysis);
            await _context.SaveChangesAsync();
        }

        public async Task<Submission?> UpdateStatusAsync(Guid id, string status)
        {
            // Defense in depth: UpdateStatusDtoValidator already rejects an
            // unknown status before the request reaches this point, but this
            // guard means the service is still safe if ever called directly
            // (e.g. from a future internal job) rather than only via the API.
            if (!SubmissionStatuses.All.Contains(status))
            {
                throw new ArgumentException($"Unknown status '{status}'.", nameof(status));
            }

            var submission = await _context.Submissions.FindAsync(id);
            if (submission == null) return null;

            submission.Status = status;
            await _context.SaveChangesAsync();

            return submission;
        }
    }
}