using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Collection.Services;

public interface IJobService
{
    Task<JobResponseDto> CreateAndAssignAsync(CreateJobDto dto);
    Task<JobResponseDto> AcceptAsync(Guid jobId, Guid requestingUserId);
    Task<JobResponseDto> RejectAsync(Guid jobId, Guid requestingUserId, RejectJobDto dto);
    Task<JobResponseDto> CompleteAsync(Guid jobId, Guid requestingUserId, CompleteJobDto dto);
    Task<List<JobResponseDto>> GetMyJobsAsync(Guid requestingUserId, JobStatus? status);
    Task<JobResponseDto?> GetByIdAsync(Guid jobId, Guid requestingUserId, bool isPrivileged);
    Task<List<JobResponseDto>> GetAllAsync(JobStatus? status);
}

public class JobService : IJobService
{
    private readonly ApplicationDbContext _db;
    private readonly IGeoService _geoService;
    private readonly IMatchingService _matchingService;

    public JobService(ApplicationDbContext db, IGeoService geoService, IMatchingService matchingService)
    {
        _db = db;
        _geoService = geoService;
        _matchingService = matchingService;
    }

    public async Task<JobResponseDto> CreateAndAssignAsync(CreateJobDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.PickupAddress))
            throw new ArgumentException("PickupAddress is required.");

        var job = new Job
        {
            SubmissionId = dto.SubmissionId,
            PickupAddress = dto.PickupAddress,
            ScheduledWindowStart = dto.ScheduledWindowStart,
            ScheduledWindowEnd = dto.ScheduledWindowEnd
        };

        var coordinates = await _geoService.GeocodeAsync(dto.PickupAddress);

        if (coordinates is null)
        {
            // Address couldn't be resolved — flag for staff rather than
            // guessing or blocking. No point trying to match a collector
            // against a location we don't have.
            job.Status = JobStatus.PickupLocationUnresolved;
            _db.Jobs.Add(job);
            await _db.SaveChangesAsync();
            return ToDto(job);
        }

        job.PickupLatitude = coordinates.Value.Latitude;
        job.PickupLongitude = coordinates.Value.Longitude;

        var candidate = await FindBestCandidateAsync(job, dto.RequiredCapacityKg, excludeCollectorIds: new List<Guid>());

        ApplyAssignmentOutcome(job, candidate);

        _db.Jobs.Add(job);
        await _db.SaveChangesAsync();

        if (candidate is not null)
            await LogHistoryAsync(job.JobId, candidate.CollectorId, AssignmentOutcome.Assigned);

        return ToDto(job);
    }

    public async Task<JobResponseDto> AcceptAsync(Guid jobId, Guid requestingUserId)
    {
        var job = await GetOwnedJobAsync(jobId, requestingUserId);

        if (job.Status != JobStatus.Assigned)
            throw new InvalidOperationException($"Cannot accept a job in status '{job.Status}'.");

        job.Status = JobStatus.Accepted;
        job.RespondedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await LogHistoryAsync(job.JobId, job.CollectorId!.Value, AssignmentOutcome.Accepted);

        return ToDto(job);
    }

    public async Task<JobResponseDto> RejectAsync(Guid jobId, Guid requestingUserId, RejectJobDto dto)
    {
        var job = await GetOwnedJobAsync(jobId, requestingUserId);

        if (job.Status != JobStatus.Assigned)
            throw new InvalidOperationException($"Cannot reject a job in status '{job.Status}'.");

        var rejectingCollectorId = job.CollectorId!.Value;

        job.Status = JobStatus.Rejected;
        job.RejectionReason = dto.Reason;
        job.RespondedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

        await LogHistoryAsync(jobId, rejectingCollectorId, AssignmentOutcome.Rejected, dto.Reason);

        // Reassignment: exclude every collector who's already been offered
        // this job (rejecters, and — belt and braces — anyone already
        // assigned), then try again.
        var alreadyOffered = await _db.JobAssignmentHistory
            .Where(h => h.JobId == jobId)
            .Select(h => h.CollectorId)
            .Distinct()
            .ToListAsync();

        var nextCandidate = job.PickupLatitude is null || job.PickupLongitude is null
            ? null
            : await FindBestCandidateAsync(job, requiredCapacityKg: null, excludeCollectorIds: alreadyOffered);

        job.RejectionReason = null; // stale once we move to a new assignment attempt; history keeps the real record
        ApplyAssignmentOutcome(job, nextCandidate);
        await _db.SaveChangesAsync();

        if (nextCandidate is not null)
            await LogHistoryAsync(jobId, nextCandidate.CollectorId, AssignmentOutcome.Assigned);

        return ToDto(job);
    }

    public async Task<JobResponseDto> CompleteAsync(Guid jobId, Guid requestingUserId, CompleteJobDto dto)
    {
        var job = await GetOwnedJobAsync(jobId, requestingUserId);

        if (job.Status is not (JobStatus.Accepted or JobStatus.InProgress))
            throw new InvalidOperationException($"Cannot complete a job in status '{job.Status}'.");

        if (string.IsNullOrWhiteSpace(dto.PhotoUrl))
            throw new ArgumentException("PhotoUrl is required to confirm a pickup.");

        if (dto.MeasuredWeightKg <= 0)
            throw new ArgumentException("MeasuredWeightKg must be greater than zero.");

        job.PhotoUrl = dto.PhotoUrl;
        job.MeasuredWeightKg = dto.MeasuredWeightKg;
        job.Notes = dto.Notes;
        job.Status = JobStatus.Completed;
        job.CompletedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return ToDto(job);
    }

    public async Task<List<JobResponseDto>> GetMyJobsAsync(Guid requestingUserId, JobStatus? status)
    {
        var collector = await _db.Collectors.FirstOrDefaultAsync(c => c.UserId == requestingUserId)
            ?? throw new KeyNotFoundException("No collector profile exists for this user.");

        var query = _db.Jobs.Where(j => j.CollectorId == collector.CollectorId);

        if (status is not null)
            query = query.Where(j => j.Status == status);

        var jobs = await query.OrderByDescending(j => j.CreatedAt).ToListAsync();
        return jobs.Select(ToDto).ToList();
    }

    public async Task<JobResponseDto?> GetByIdAsync(Guid jobId, Guid requestingUserId, bool isPrivileged)
    {
        var job = await _db.Jobs.FindAsync(jobId);
        if (job is null) return null;

        if (isPrivileged) return ToDto(job);

        // Non-privileged callers (collectors) can only view their own job.
        var collector = await _db.Collectors.FirstOrDefaultAsync(c => c.UserId == requestingUserId);
        if (collector is null || job.CollectorId != collector.CollectorId)
            throw new UnauthorizedAccessException("You do not have permission to view this job.");

        return ToDto(job);
    }

    public async Task<List<JobResponseDto>> GetAllAsync(JobStatus? status)
    {
        var query = _db.Jobs.AsQueryable();

        if (status is not null)
            query = query.Where(j => j.Status == status);

        var jobs = await query.OrderByDescending(j => j.CreatedAt).ToListAsync();
        return jobs.Select(ToDto).ToList();
    }

    // --- helpers -----------------------------------------------------

    private async Task<CollectorMatchDto?> FindBestCandidateAsync(
        Job job, decimal? requiredCapacityKg, List<Guid> excludeCollectorIds)
    {
        var results = await _matchingService.FindCandidatesAsync(new MatchRequestDto
        {
            PickupLatitude = job.PickupLatitude!.Value,
            PickupLongitude = job.PickupLongitude!.Value,
            RequiredCapacityKg = requiredCapacityKg,
            ExcludeCollectorIds = excludeCollectorIds,
            MaxResults = 1
        });

        return results.FirstOrDefault();
    }

    private static void ApplyAssignmentOutcome(Job job, CollectorMatchDto? candidate)
    {
        if (candidate is null)
        {
            job.CollectorId = null;
            job.Status = JobStatus.NoCollectorAvailable;
            job.EstimatedDistanceKm = null;
            job.EstimatedEtaMinutes = null;
            return;
        }

        job.CollectorId = candidate.CollectorId;
        job.Status = JobStatus.Assigned;
        job.EstimatedDistanceKm = candidate.DistanceKm;
        job.EstimatedEtaMinutes = candidate.EtaMinutes;
    }

    private async Task LogHistoryAsync(Guid jobId, Guid collectorId, AssignmentOutcome outcome, string? reason = null)
    {
        _db.JobAssignmentHistory.Add(new JobAssignmentHistory
        {
            JobId = jobId,
            CollectorId = collectorId,
            Outcome = outcome,
            Reason = reason
        });
        await _db.SaveChangesAsync();
    }

    // Every write endpoint (accept/reject/complete) goes through this —
    // a collector can only act on their own job, never someone else's,
    // even if they guess another job's id.
    private async Task<Job> GetOwnedJobAsync(Guid jobId, Guid requestingUserId)
    {
        var job = await _db.Jobs.FindAsync(jobId)
            ?? throw new KeyNotFoundException("Job not found.");

        var collector = await _db.Collectors.FirstOrDefaultAsync(c => c.UserId == requestingUserId)
            ?? throw new UnauthorizedAccessException("No collector profile exists for this user.");

        if (job.CollectorId != collector.CollectorId)
            throw new UnauthorizedAccessException("You do not have permission to act on this job.");

        return job;
    }

    private static JobResponseDto ToDto(Job j) => new()
    {
        JobId = j.JobId,
        SubmissionId = j.SubmissionId,
        CollectorId = j.CollectorId,
        Status = j.Status.ToString(),
        PickupAddress = j.PickupAddress,
        PickupLatitude = j.PickupLatitude,
        PickupLongitude = j.PickupLongitude,
        ScheduledWindowStart = j.ScheduledWindowStart,
        ScheduledWindowEnd = j.ScheduledWindowEnd,
        EstimatedEtaMinutes = j.EstimatedEtaMinutes,
        EstimatedDistanceKm = j.EstimatedDistanceKm,
        PhotoUrl = j.PhotoUrl,
        MeasuredWeightKg = j.MeasuredWeightKg,
        Notes = j.Notes,
        RejectionReason = j.RejectionReason,
        CreatedAt = j.CreatedAt,
        RespondedAt = j.RespondedAt,
        CompletedAt = j.CompletedAt
    };
}
