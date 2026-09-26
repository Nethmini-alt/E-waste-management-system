using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Collection.Services;

public interface IMatchingService
{
    Task<List<CollectorMatchDto>> FindCandidatesAsync(MatchRequestDto request);
}

// Shared by matching, the job service and the staff collector list, so the
// "what counts as busy" rule lives in exactly one place.
public static class MatchingRules
{
    // A collector juggling too many jobs at once shouldn't be handed another
    // one, even if they're geographically closest. Simple, explicit cap
    // rather than a more elaborate load-balancing scheme.
    public const int MaxActiveJobsPerCollector = 3;

    public static readonly JobStatus[] ActiveStatuses =
        { JobStatus.Assigned, JobStatus.Accepted, JobStatus.InProgress };
}

public class MatchingService : IMatchingService
{
    private const int MaxActiveJobsPerCollector = MatchingRules.MaxActiveJobsPerCollector;
    private static readonly JobStatus[] ActiveStatuses = MatchingRules.ActiveStatuses;

    private readonly ApplicationDbContext _db;
    private readonly IGeoService _mapsService;

    public MatchingService(ApplicationDbContext db, IGeoService mapsService)
    {
        _db = db;
        _mapsService = mapsService;
    }

    public async Task<List<CollectorMatchDto>> FindCandidatesAsync(MatchRequestDto request)
    {
        var excludeIds = request.ExcludeCollectorIds ?? new List<Guid>();

        // Step 1: pull candidates that are available, positioned, capable,
        // and not already excluded — everything a plain SQL WHERE can do.
        var candidates = await _db.Collectors
            .Where(c => c.IsAvailable)
            .Where(c => c.CurrentLatitude != null && c.CurrentLongitude != null)
            .Where(c => request.RequiredCapacityKg == null || c.CapacityKg >= request.RequiredCapacityKg)
            .Where(c => !excludeIds.Contains(c.CollectorId))
            .ToListAsync();

        if (candidates.Count == 0)
            return new List<CollectorMatchDto>();

        // Step 2: current load per candidate, then drop anyone already at the cap.
        var candidateIds = candidates.Select(c => c.CollectorId).ToList();
        var activeJobCounts = await _db.Jobs
            .Where(j => j.CollectorId != null && candidateIds.Contains(j.CollectorId.Value))
            .Where(j => ActiveStatuses.Contains(j.Status))
            .GroupBy(j => j.CollectorId!.Value)
            .Select(g => new { CollectorId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.CollectorId, x => x.Count);

        var eligible = candidates
            .Select(c => new { Collector = c, ActiveJobs = activeJobCounts.GetValueOrDefault(c.CollectorId, 0) })
            .Where(x => x.ActiveJobs < MaxActiveJobsPerCollector)
            .ToList();

        if (eligible.Count == 0)
            return new List<CollectorMatchDto>();

        // Step 3: distance/ETA per candidate. These are independent HTTP
        // calls, so run them concurrently rather than one at a time.
        var distanceTasks = eligible.Select(x => _mapsService.GetDistanceAsync(
            x.Collector.CurrentLatitude!.Value, x.Collector.CurrentLongitude!.Value,
            request.PickupLatitude, request.PickupLongitude));
        var distances = await Task.WhenAll(distanceTasks);

        var eligibleUserIds = eligible.Select(x => x.Collector.UserId).ToList();
        var names = await _db.Users
            .Where(u => eligibleUserIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.FullName);

        var results = eligible.Zip(distances, (x, distance) => new CollectorMatchDto
        {
            CollectorId = x.Collector.CollectorId,
            CollectorName = names.GetValueOrDefault(x.Collector.UserId, string.Empty),
            VehicleType = x.Collector.VehicleType,
            CapacityKg = x.Collector.CapacityKg,
            Rating = x.Collector.Rating,
            ActiveJobCount = x.ActiveJobs,
            DistanceKm = distance?.DistanceKm,
            EtaMinutes = distance?.DurationMinutes
        }).ToList();

        // Step 4: radius filter, if requested — applied on the real driving
        // distance from the routing service (OSRM), not straight-line, so it's an honest cutoff.
        if (request.RadiusKm is not null)
        {
            results = results
                .Where(r => r.DistanceKm is null || r.DistanceKm <= request.RadiusKm)
                .ToList();
        }

        // Step 5: rank — nearest first, then lightest current load, then
        // highest rating as the final tiebreaker. Unresolved distances sort last.
        var ranked = results
            .OrderBy(r => r.DistanceKm is null)
            .ThenBy(r => r.DistanceKm)
            .ThenBy(r => r.ActiveJobCount)
            .ThenByDescending(r => r.Rating)
            .Take(request.MaxResults)
            .ToList();

        return ranked;
    }
}
