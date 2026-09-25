using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Entities;

namespace EWasteManagement.Tests.Collection;

public class MatchingServiceTests : CollectionTestBase
{
    private static MatchRequestDto Request() => new()
    {
        PickupLatitude = PickupLat,
        PickupLongitude = PickupLng
    };

    [Fact]
    public async Task FindCandidatesAsync_NoCollectors_ReturnsEmpty()
    {
        var result = await CreateMatchingService().FindCandidatesAsync(Request());

        Assert.Empty(result);
    }

    [Fact]
    public async Task FindCandidatesAsync_SkipsUnavailableAndUnlocatedCollectors()
    {
        var eligible = await SeedCollectorAsync(latitude: 6.91m);
        await SeedCollectorAsync(isAvailable: false, latitude: 6.92m);
        await SeedCollectorAsync(hasLocation: false);

        var result = await CreateMatchingService().FindCandidatesAsync(Request());

        var match = Assert.Single(result);
        Assert.Equal(eligible.CollectorId, match.CollectorId);
    }

    [Fact]
    public async Task FindCandidatesAsync_RequiredCapacity_FiltersOutSmallVehicles()
    {
        var big = await SeedCollectorAsync(latitude: 6.91m, capacityKg: 1000m);
        await SeedCollectorAsync(latitude: 6.92m, capacityKg: 100m);

        var request = Request();
        request.RequiredCapacityKg = 500m;
        var result = await CreateMatchingService().FindCandidatesAsync(request);

        var match = Assert.Single(result);
        Assert.Equal(big.CollectorId, match.CollectorId);
    }

    [Fact]
    public async Task FindCandidatesAsync_ExcludedCollectors_AreNotReturned()
    {
        var excluded = await SeedCollectorAsync(latitude: 6.91m);
        var kept = await SeedCollectorAsync(latitude: 6.92m);

        var request = Request();
        request.ExcludeCollectorIds = new List<Guid> { excluded.CollectorId };
        var result = await CreateMatchingService().FindCandidatesAsync(request);

        var match = Assert.Single(result);
        Assert.Equal(kept.CollectorId, match.CollectorId);
    }

    [Fact]
    public async Task FindCandidatesAsync_CollectorAtActiveJobCap_IsExcluded_CompletedJobsDoNotCount()
    {
        var busy = await SeedCollectorAsync(latitude: 6.91m);
        await SeedJobAsync(busy.CollectorId, JobStatus.Assigned);
        await SeedJobAsync(busy.CollectorId, JobStatus.Accepted);
        await SeedJobAsync(busy.CollectorId, JobStatus.InProgress);

        var experienced = await SeedCollectorAsync(latitude: 6.92m);
        await SeedJobAsync(experienced.CollectorId, JobStatus.Accepted);
        await SeedJobAsync(experienced.CollectorId, JobStatus.InProgress);
        for (var i = 0; i < 5; i++)
            await SeedJobAsync(experienced.CollectorId, JobStatus.Completed);

        var result = await CreateMatchingService().FindCandidatesAsync(Request());

        var match = Assert.Single(result);
        Assert.Equal(experienced.CollectorId, match.CollectorId);
        Assert.Equal(2, match.ActiveJobCount);
    }

    [Fact]
    public async Task FindCandidatesAsync_RanksByDistance_ThenActiveJobs_ThenRating()
    {
        var far = await SeedCollectorAsync(latitude: 6.91m, rating: 5.0m);
        var nearBest = await SeedCollectorAsync(latitude: 6.92m, rating: 5.0m);
        var nearBusy = await SeedCollectorAsync(latitude: 6.93m, rating: 5.0m);
        var nearLowerRated = await SeedCollectorAsync(latitude: 6.94m, rating: 4.0m);

        Geo.SetDistanceFrom(6.91m, 79.8600m, (8m, 20));
        Geo.SetDistanceFrom(6.92m, 79.8600m, (3m, 8));
        Geo.SetDistanceFrom(6.93m, 79.8600m, (3m, 8));
        Geo.SetDistanceFrom(6.94m, 79.8600m, (3m, 8));
        await SeedJobAsync(nearBusy.CollectorId, JobStatus.Accepted);

        var result = await CreateMatchingService().FindCandidatesAsync(Request());

        Assert.Equal(
            new[] { nearBest.CollectorId, nearLowerRated.CollectorId, nearBusy.CollectorId, far.CollectorId },
            result.Select(r => r.CollectorId).ToArray());
        Assert.Equal(3m, result[0].DistanceKm);
        Assert.Equal(8, result[0].EtaMinutes);
    }

    [Fact]
    public async Task FindCandidatesAsync_UnresolvedDistance_IsSortedLastNotDropped()
    {
        var unresolved = await SeedCollectorAsync(latitude: 6.91m);
        var resolved = await SeedCollectorAsync(latitude: 6.92m);
        Geo.SetDistanceFrom(6.91m, 79.8600m, null);
        Geo.SetDistanceFrom(6.92m, 79.8600m, (15m, 30));

        var result = await CreateMatchingService().FindCandidatesAsync(Request());

        Assert.Equal(2, result.Count);
        Assert.Equal(resolved.CollectorId, result[0].CollectorId);
        Assert.Equal(unresolved.CollectorId, result[1].CollectorId);
        Assert.Null(result[1].DistanceKm);
    }

    [Fact]
    public async Task FindCandidatesAsync_Radius_DropsCollectorsBeyondIt()
    {
        var inside = await SeedCollectorAsync(latitude: 6.91m);
        await SeedCollectorAsync(latitude: 6.92m);
        Geo.SetDistanceFrom(6.91m, 79.8600m, (4m, 10));
        Geo.SetDistanceFrom(6.92m, 79.8600m, (25m, 45));

        var request = Request();
        request.RadiusKm = 10m;
        var result = await CreateMatchingService().FindCandidatesAsync(request);

        var match = Assert.Single(result);
        Assert.Equal(inside.CollectorId, match.CollectorId);
    }

    [Fact]
    public async Task FindCandidatesAsync_MaxResults_LimitsCount()
    {
        for (var i = 0; i < 4; i++)
            await SeedCollectorAsync(latitude: 6.91m + i / 100m);

        var request = Request();
        request.MaxResults = 2;
        var result = await CreateMatchingService().FindCandidatesAsync(request);

        Assert.Equal(2, result.Count);
    }
}
