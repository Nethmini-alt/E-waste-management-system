using EWasteManagement.API.Features.Collection.Controllers;
using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Collection.Services;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.Tests.Collection;

// Covers the Matcher recommendation, stored capacity, the start action, and
// the staff actions (history, fix address, reassign, cancel, collectors list).
public class JobServiceFixesTests : CollectionTestBase
{
    private static CreateJobDto NewJob(decimal? requiredCapacityKg = null, Guid? preferredCollectorId = null) => new()
    {
        SubmissionId = Guid.NewGuid(),
        PickupAddress = "12 Galle Road, Colombo 03",
        RequiredCapacityKg = requiredCapacityKg,
        PreferredCollectorId = preferredCollectorId
    };

    private async Task SetRequiredCapacityAsync(Job job, decimal kg)
    {
        job.RequiredCapacityKg = kg;
        await Db.SaveChangesAsync();
    }

    // --- Fix 1: Matcher's recommended collector ------------------------

    [Fact]
    public async Task CreateAndAssignAsync_PreferredCollectorStillEligible_AssignsThemEvenIfNotNearest()
    {
        var nearest = await SeedCollectorAsync(latitude: 6.91m);
        var recommended = await SeedCollectorAsync(latitude: 6.92m);
        Geo.SetDistanceFrom(6.91m, 79.8600m, (2m, 6));
        Geo.SetDistanceFrom(6.92m, 79.8600m, (9m, 22));

        var result = await CreateJobService().CreateAndAssignAsync(NewJob(preferredCollectorId: recommended.CollectorId));

        Assert.Equal(recommended.CollectorId, result.CollectorId);
        Assert.NotEqual(nearest.CollectorId, result.CollectorId);
        Assert.Equal(9m, result.EstimatedDistanceKm);

        var history = await Db.JobAssignmentHistory.SingleAsync(h => h.JobId == result.JobId);
        Assert.Equal(JobService.MatcherRecommendationFollowed, history.Reason);
    }

    [Fact]
    public async Task CreateAndAssignAsync_PreferredCollectorWentOffline_FallsBackAndRecordsWhy()
    {
        var recommended = await SeedCollectorAsync(isAvailable: false);
        var backup = await SeedCollectorAsync(latitude: 6.92m);

        var result = await CreateJobService().CreateAndAssignAsync(NewJob(preferredCollectorId: recommended.CollectorId));

        Assert.Equal(backup.CollectorId, result.CollectorId);
        var history = await Db.JobAssignmentHistory.SingleAsync(h => h.JobId == result.JobId);
        Assert.Contains("could no longer take this job", history.Reason);
        Assert.Contains("Test User", history.Reason);
    }

    [Fact]
    public async Task CreateAndAssignAsync_PreferredCollectorTooSmallForLoad_FallsBackToOneThatFits()
    {
        var recommended = await SeedCollectorAsync(latitude: 6.91m, capacityKg: 100m);
        var bigEnough = await SeedCollectorAsync(latitude: 6.92m, capacityKg: 1000m);

        var result = await CreateJobService().CreateAndAssignAsync(
            NewJob(requiredCapacityKg: 300m, preferredCollectorId: recommended.CollectorId));

        Assert.Equal(bigEnough.CollectorId, result.CollectorId);
    }

    [Fact]
    public async Task CreateAndAssignAsync_NoPreference_LeavesHistoryReasonEmpty()
    {
        await SeedCollectorAsync();

        var result = await CreateJobService().CreateAndAssignAsync(NewJob());

        var history = await Db.JobAssignmentHistory.SingleAsync(h => h.JobId == result.JobId);
        Assert.Null(history.Reason);
    }

    // --- Fix 2: capacity kept for every re-match ------------------------

    [Fact]
    public async Task CreateAndAssignAsync_StoresRequiredCapacityOnJob()
    {
        await SeedCollectorAsync(capacityKg: 1000m);

        var result = await CreateJobService().CreateAndAssignAsync(NewJob(requiredCapacityKg: 300m));

        Assert.Equal(300m, result.RequiredCapacityKg);
        Assert.Equal(300m, (await Db.Jobs.SingleAsync(j => j.JobId == result.JobId)).RequiredCapacityKg);
    }

    [Fact]
    public async Task RejectAsync_Reassignment_SkipsCollectorsTooSmallForTheLoad()
    {
        var rejecter = await SeedCollectorAsync(latitude: 6.91m, capacityKg: 1000m);
        var tooSmallButNearest = await SeedCollectorAsync(latitude: 6.92m, capacityKg: 250m);
        var bigEnough = await SeedCollectorAsync(latitude: 6.93m, capacityKg: 800m);
        Geo.SetDistanceFrom(6.92m, 79.8600m, (1m, 3));
        Geo.SetDistanceFrom(6.93m, 79.8600m, (8m, 20));

        var job = await SeedJobAsync(rejecter.CollectorId);
        await SetRequiredCapacityAsync(job, 300m);

        var result = await CreateJobService().RejectAsync(job.JobId, rejecter.UserId, new RejectJobDto { Reason = "Busy" });

        Assert.Equal(bigEnough.CollectorId, result.CollectorId);
        Assert.NotEqual(tooSmallButNearest.CollectorId, result.CollectorId);
    }

    [Fact]
    public async Task ReassignAsync_AutoMatch_SkipsCollectorsTooSmallForTheLoad()
    {
        await SeedCollectorAsync(latitude: 6.92m, capacityKg: 250m);
        var bigEnough = await SeedCollectorAsync(latitude: 6.93m, capacityKg: 800m);

        var job = await SeedJobAsync(collectorId: null, status: JobStatus.NoCollectorAvailable);
        await SetRequiredCapacityAsync(job, 300m);

        var result = await CreateJobService().ReassignAsync(job.JobId, new ReassignJobDto());

        Assert.Equal(bigEnough.CollectorId, result.CollectorId);
    }

    // --- Fix 3: StartAsync (Accepted -> InProgress) --------------------

    [Fact]
    public async Task StartAsync_Accepted_MarksInProgressAndRecordsTime()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Accepted);

        var result = await CreateJobService().StartAsync(job.JobId, collector.UserId);

        Assert.Equal(nameof(JobStatus.InProgress), result.Status);
        Assert.NotNull(result.StartedAt);
    }

    [Fact]
    public async Task StartAsync_AlreadyInProgress_IsHarmlessAndKeepsOriginalStartTime()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Accepted);
        var service = CreateJobService();

        var first = await service.StartAsync(job.JobId, collector.UserId);
        var second = await service.StartAsync(job.JobId, collector.UserId);

        Assert.Equal(nameof(JobStatus.InProgress), second.Status);
        Assert.Equal(first.StartedAt, second.StartedAt);
    }

    [Theory]
    [InlineData(JobStatus.Assigned)]
    [InlineData(JobStatus.Completed)]
    [InlineData(JobStatus.Cancelled)]
    public async Task StartAsync_NotAccepted_ThrowsInvalidOperation(JobStatus status)
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, status);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateJobService().StartAsync(job.JobId, collector.UserId));
    }

    [Fact]
    public async Task StartAsync_AnotherCollectorsJob_ThrowsUnauthorized()
    {
        var owner = await SeedCollectorAsync();
        var other = await SeedCollectorAsync();
        var job = await SeedJobAsync(owner.CollectorId, JobStatus.Accepted);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            CreateJobService().StartAsync(job.JobId, other.UserId));
    }

    [Fact]
    public async Task CompleteAsync_AfterStart_Completes()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Accepted);
        var service = CreateJobService();
        await service.StartAsync(job.JobId, collector.UserId);

        var result = await service.CompleteAsync(job.JobId, collector.UserId,
            new CompleteJobDto { PhotoUrl = "https://example.com/p.jpg", MeasuredWeightKg = 10m });

        Assert.Equal(nameof(JobStatus.Completed), result.Status);
    }

    // The Flutter app relies on these status codes to show the right message.
    [Fact]
    public async Task StartEndpoint_ReturnsOk_Forbidden_Conflict()
    {
        var owner = await SeedCollectorAsync();
        var other = await SeedCollectorAsync();
        var accepted = await SeedJobAsync(owner.CollectorId, JobStatus.Accepted);
        var stillAssigned = await SeedJobAsync(owner.CollectorId, JobStatus.Assigned);

        JobsController As(Guid userId) => new JobsController(CreateJobService()).WithUser(userId, "Collector");

        Assert.Equal(403, ControllerTestExtensions.StatusCodeOf(await As(other.UserId).Start(accepted.JobId)));
        Assert.Equal(409, ControllerTestExtensions.StatusCodeOf(await As(owner.UserId).Start(stillAssigned.JobId)));
        Assert.Equal(404, ControllerTestExtensions.StatusCodeOf(await As(owner.UserId).Start(Guid.NewGuid())));

        var ok = await As(owner.UserId).Start(accepted.JobId);
        Assert.Equal(200, ControllerTestExtensions.StatusCodeOf(ok));
        Assert.Equal(nameof(JobStatus.InProgress), ControllerTestExtensions.ValueOf(ok).Status);
    }

    // --- Staff: history -------------------------------------------------

    [Fact]
    public async Task GetHistoryAsync_ReturnsEntriesOldestFirstWithCollectorNames()
    {
        var rejecter = await SeedCollectorAsync(latitude: 6.91m);
        await SeedCollectorAsync(latitude: 6.92m);
        var job = await SeedJobAsync(rejecter.CollectorId);
        await CreateJobService().RejectAsync(job.JobId, rejecter.UserId, new RejectJobDto { Reason = "Busy" });

        var history = await CreateJobService().GetHistoryAsync(job.JobId);

        // Both rows are written within the same millisecond or so, so check
        // the contents and that the list is sorted, not an exact sequence.
        Assert.Equal(new[] { "Assigned", "Rejected" }, history.Select(h => h.Outcome).OrderBy(o => o));
        Assert.All(history, h => Assert.Equal("Test User", h.CollectorName));
        Assert.Equal(history.OrderBy(h => h.Timestamp).Select(h => h.HistoryId), history.Select(h => h.HistoryId));
    }

    [Fact]
    public async Task GetHistoryAsync_UnknownJob_ThrowsKeyNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => CreateJobService().GetHistoryAsync(Guid.NewGuid()));
    }

    // --- Staff: fix address ----------------------------------------------

    [Fact]
    public async Task UpdateAddressAsync_Unresolved_GeocodesAndAssigns()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collectorId: null, status: JobStatus.PickupLocationUnresolved, hasLocation: false);

        var result = await CreateJobService().UpdateAddressAsync(job.JobId,
            new UpdateJobAddressDto { PickupAddress = "  45 Duplication Road, Colombo 04  " });

        Assert.Equal("45 Duplication Road, Colombo 04", result.PickupAddress);
        Assert.Equal(PickupLat, result.PickupLatitude);
        Assert.Equal(nameof(JobStatus.Assigned), result.Status);
        Assert.Equal(collector.CollectorId, result.CollectorId);
    }

    [Fact]
    public async Task UpdateAddressAsync_StillCannotBeLocated_ThrowsAndChangesNothing()
    {
        var job = await SeedJobAsync(collectorId: null, status: JobStatus.PickupLocationUnresolved, hasLocation: false);
        Geo.GeocodeResult = null;

        await Assert.ThrowsAsync<ArgumentException>(() => CreateJobService().UpdateAddressAsync(job.JobId,
            new UpdateJobAddressDto { PickupAddress = "somewhere vague" }));

        var reloaded = await Db.Jobs.AsNoTracking().SingleAsync(j => j.JobId == job.JobId);
        Assert.Equal("12 Galle Road, Colombo 03", reloaded.PickupAddress);
        Assert.Equal(JobStatus.PickupLocationUnresolved, reloaded.Status);
    }

    [Fact]
    public async Task UpdateAddressAsync_JobAlreadyAssigned_ThrowsInvalidOperation()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Assigned);

        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateJobService().UpdateAddressAsync(job.JobId,
            new UpdateJobAddressDto { PickupAddress = "New address" }));
    }

    // --- Staff: reassign -------------------------------------------------

    [Fact]
    public async Task ReassignAsync_HandPicked_AssignsAndLogsStaffReason()
    {
        var chosen = await SeedCollectorAsync();
        var job = await SeedJobAsync(collectorId: null, status: JobStatus.NoCollectorAvailable);

        var result = await CreateJobService().ReassignAsync(job.JobId, new ReassignJobDto { CollectorId = chosen.CollectorId });

        Assert.Equal(nameof(JobStatus.Assigned), result.Status);
        Assert.Equal(chosen.CollectorId, result.CollectorId);
        var history = await Db.JobAssignmentHistory.SingleAsync(h => h.JobId == job.JobId);
        Assert.Equal("Manually assigned by staff", history.Reason);
    }

    [Fact]
    public async Task ReassignAsync_HandPickedCollectorOffline_ThrowsInvalidOperation()
    {
        var offline = await SeedCollectorAsync(isAvailable: false);
        var job = await SeedJobAsync(collectorId: null, status: JobStatus.NoCollectorAvailable);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateJobService().ReassignAsync(job.JobId, new ReassignJobDto { CollectorId = offline.CollectorId }));
    }

    [Fact]
    public async Task ReassignAsync_AutoMatchOnAssignedJobWithNobodyElse_ThrowsAndKeepsCurrentCollector()
    {
        var current = await SeedCollectorAsync();
        var job = await SeedJobAsync(current.CollectorId, JobStatus.Assigned);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateJobService().ReassignAsync(job.JobId, new ReassignJobDto()));

        var reloaded = await Db.Jobs.AsNoTracking().SingleAsync(j => j.JobId == job.JobId);
        Assert.Equal(current.CollectorId, reloaded.CollectorId);
        Assert.Equal(JobStatus.Assigned, reloaded.Status);
    }

    [Fact]
    public async Task ReassignAsync_AutoMatch_NeverPicksSomeoneWhoRejectedTheJob()
    {
        var rejecter = await SeedCollectorAsync(latitude: 6.91m);
        Geo.SetDistanceFrom(6.91m, 79.8600m, (1m, 3));
        var job = await SeedJobAsync(rejecter.CollectorId);
        await CreateJobService().RejectAsync(job.JobId, rejecter.UserId, new RejectJobDto());
        var newcomer = await SeedCollectorAsync(latitude: 6.95m); // came online later, further away

        var result = await CreateJobService().ReassignAsync(job.JobId, new ReassignJobDto());

        Assert.Equal(newcomer.CollectorId, result.CollectorId);
    }

    // --- Staff: cancel ---------------------------------------------------

    [Fact]
    public async Task CancelAsync_AcceptedJob_CancelsAndStopsCountingTowardsLoad()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Accepted);

        var result = await CreateJobService().CancelAsync(job.JobId);

        Assert.Equal(nameof(JobStatus.Cancelled), result.Status);
        var listed = (await CreateCollectorService().GetAllAsync(null)).Single();
        Assert.Equal(0, listed.ActiveJobCount);
    }

    [Theory]
    [InlineData(JobStatus.Completed)]
    [InlineData(JobStatus.Cancelled)]
    public async Task CancelAsync_AlreadyFinished_ThrowsInvalidOperation(JobStatus status)
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, status);

        await Assert.ThrowsAsync<InvalidOperationException>(() => CreateJobService().CancelAsync(job.JobId));
    }

    // --- Staff: collectors list ------------------------------------------

    [Fact]
    public async Task CollectorGetAllAsync_IncludesNamesAndActiveJobCounts_AndFiltersByAvailability()
    {
        var busy = await SeedCollectorAsync();
        await SeedCollectorAsync(isAvailable: false);
        await SeedJobAsync(busy.CollectorId, JobStatus.Assigned);
        await SeedJobAsync(busy.CollectorId, JobStatus.InProgress);
        await SeedJobAsync(busy.CollectorId, JobStatus.Completed); // finished jobs don't count

        var all = await CreateCollectorService().GetAllAsync(null);
        var onlineOnly = await CreateCollectorService().GetAllAsync(true);

        Assert.Equal(2, all.Count);
        var busyDto = Assert.Single(onlineOnly);
        Assert.Equal(busy.CollectorId, busyDto.CollectorId);
        Assert.Equal("Test User", busyDto.FullName);
        Assert.Equal(2, busyDto.ActiveJobCount);
        Assert.Equal(MatchingRules.MaxActiveJobsPerCollector, busyDto.MaxActiveJobs);
    }
}
