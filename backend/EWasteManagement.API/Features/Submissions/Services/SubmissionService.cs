using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using EWasteManagement.Api.Dtos;
using EWasteManagement.Api.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Workflow.DTOs;
using EWasteManagement.API.Features.Workflow.Entities;
using EWasteManagement.API.Features.Workflow.Services;
using EWasteManagement.API.Infrastructure.Persistence;

namespace EWasteManagement.Api.Services
{
    public class SubmissionService : ISubmissionService
    {
        private readonly ApplicationDbContext _context;
        private readonly IWorkflowService _workflows;
        private readonly IWorkflowOrchestrationService _orchestrator;

        public SubmissionService(
            ApplicationDbContext context,
            IWorkflowService workflows,
            IWorkflowOrchestrationService orchestrator)
        {
            _context = context;
            _workflows = workflows;
            _orchestrator = orchestrator;
        }

        public async Task<SubmissionResponseDto> CreateSubmissionAsync(
            CreateSubmissionDto dto, Guid userId, string userType, CancellationToken ct = default)
        {
            var submission = new Submission
            {
                UserId = userId,
                UserType = userType,
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

            // Submission and its workflow are committed in ONE SaveChanges, so
            // there is never a submission without a workflow. Only after the
            // commit is the workflow queued for the background chain
            // (Planner -> Analyzer -> Validator -> Matcher), which keeps this
            // request fast.
            var workflow = _workflows.Add(submission.Id);
            await _context.SaveChangesAsync(ct);
            _orchestrator.Start(workflow.WorkflowId);

            return (await GetSubmissionByIdAsync(submission.Id, ct))!;
        }

        public async Task<SubmissionResponseDto?> GetSubmissionByIdAsync(Guid id, CancellationToken ct = default)
        {
            var rows = await QueryRows(_context.Submissions.Where(s => s.Id == id)).ToListAsync(ct);
            return rows.Select(ToDto).FirstOrDefault();
        }

        public async Task<List<SubmissionResponseDto>> GetAllSubmissionsAsync(CancellationToken ct = default)
        {
            var rows = await QueryRows(_context.Submissions).ToListAsync(ct);
            return rows.Select(ToDto).ToList();
        }

        public async Task<List<SubmissionResponseDto>> GetSubmissionsForUserAsync(Guid userId, CancellationToken ct = default)
        {
            var rows = await QueryRows(_context.Submissions.Where(s => s.UserId == userId)).ToListAsync(ct);
            return rows.Select(ToDto).ToList();
        }

        // One SQL query for any number of submissions: the latest workflow,
        // latest job, last failed agent step and last rejection comment are
        // correlated subqueries, not a query per submission. Workflow and Job
        // hold loose SubmissionId ids (no navigations), hence the explicit joins.
        private IQueryable<SubmissionRow> QueryRows(IQueryable<Submission> source) =>
            from s in source.AsNoTracking()
            let w = _context.CollectionWorkflows
                .Where(x => x.SubmissionId == s.Id)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefault()
            let j = _context.Jobs
                .Where(x => x.SubmissionId == s.Id)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefault()
            orderby s.CreatedAt descending
            select new SubmissionRow
            {
                Id = s.Id,
                UserId = s.UserId,
                UserType = s.UserType,
                Category = s.Category,
                EstimatedWeight = s.EstimatedWeight,
                PickupAddress = s.PickupAddress,
                PhoneNumber = s.PhoneNumber,
                CreatedAt = s.CreatedAt,
                Items = s.Items.Select(i => new SubmissionItemResponseDto
                {
                    Id = i.Id,
                    ItemName = i.ItemName,
                    Description = i.Description,
                    ImageUrl = i.ImageUrl,
                }).ToList(),

                WorkflowId = w == null ? null : w.WorkflowId,
                WorkflowStatus = w == null ? null : w.Status,
                ApprovalRequired = w != null && w.ApprovalRequired,
                AnalyzerResultJson = w == null ? null : w.AnalyzerResultJson,
                FinalReasoningSummary = w == null ? null : w.FinalReasoningSummary,
                LastError = _context.AgentExecutionLogs
                    .Where(l => w != null && l.WorkflowId == w.WorkflowId && !l.Succeeded)
                    .OrderByDescending(l => l.StartedAt)
                    .Select(l => l.ErrorMessage)
                    .FirstOrDefault(),
                RejectionComment = _context.WorkflowApprovalActions
                    .Where(a => w != null && a.WorkflowId == w.WorkflowId
                        && a.ActionType == WorkflowApprovalActionType.Rejected)
                    .OrderByDescending(a => a.PerformedAt)
                    .Select(a => a.Comments)
                    .FirstOrDefault(),

                JobId = j == null ? null : j.JobId,
                JobStatus = j == null ? null : j.Status,
            };

        private static SubmissionResponseDto ToDto(SubmissionRow row)
        {
            var (code, label) = SubmissionStatusResolver.Resolve(row.WorkflowStatus, row.JobStatus);

            return new SubmissionResponseDto
            {
                Id = row.Id,
                UserId = row.UserId,
                UserType = row.UserType,
                Category = row.Category,
                EstimatedWeight = row.EstimatedWeight,
                PickupAddress = row.PickupAddress,
                PhoneNumber = row.PhoneNumber,
                CreatedAt = row.CreatedAt,
                Items = row.Items,
                Status = code,
                StatusLabel = label,
                StatusReason = code switch
                {
                    "Closed" => row.FinalReasoningSummary,
                    // A Planner "not ready for a job" decision is recorded as
                    // Failed with a finalize summary; a crash has only a log error.
                    "Failed" => row.FinalReasoningSummary ?? row.LastError,
                    "Rejected" => row.RejectionComment,
                    _ => null
                },
                Workflow = row.WorkflowId is Guid workflowId
                    ? new SubmissionWorkflowDto
                    {
                        WorkflowId = workflowId,
                        Status = row.WorkflowStatus!.Value.ToString(),
                        ApprovalRequired = row.ApprovalRequired,
                        Analysis = ParseAnalysis(row.AnalyzerResultJson),
                    }
                    : null,
                JobId = row.JobId,
                JobStatus = row.JobStatus?.ToString(),
            };
        }

        // AnalyzerResultJson is a serialized AnalyzerResultRequest, written by
        // WorkflowService.RecordAnalyzerResultAsync.
        private static SubmissionAnalysisDto? ParseAnalysis(string? json)
        {
            if (string.IsNullOrWhiteSpace(json)) return null;

            var result = JsonSerializer.Deserialize<AnalyzerResultRequest>(json);
            if (result is null) return null;

            return new SubmissionAnalysisDto
            {
                WasteCategory = result.WasteCategory,
                HazardLevel = result.HazardLevel,
                EstimatedVolumeKg = result.EstimatedVolumeKg,
                EstimatedValueUsd = result.EstimatedValueUsd,
                ConfidenceScore = result.ConfidenceScore,
            };
        }

        private sealed class SubmissionRow
        {
            public Guid Id { get; init; }
            public Guid UserId { get; init; }
            public string UserType { get; init; } = string.Empty;
            public string Category { get; init; } = string.Empty;
            public decimal EstimatedWeight { get; init; }
            public string PickupAddress { get; init; } = string.Empty;
            public string PhoneNumber { get; init; } = string.Empty;
            public DateTime CreatedAt { get; init; }
            public List<SubmissionItemResponseDto> Items { get; init; } = new();

            public Guid? WorkflowId { get; init; }
            public WorkflowStatus? WorkflowStatus { get; init; }
            public bool ApprovalRequired { get; init; }
            public string? AnalyzerResultJson { get; init; }
            public string? FinalReasoningSummary { get; init; }
            public string? LastError { get; init; }
            public string? RejectionComment { get; init; }

            public Guid? JobId { get; init; }
            public JobStatus? JobStatus { get; init; }
        }
    }
}
