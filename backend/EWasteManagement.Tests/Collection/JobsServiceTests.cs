using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Entities;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.Tests.Collection;

public class JobServiceTests : CollectionTestBase
{
    private static CreateJobDto NewJob(decimal? requiredCapacityKg = null) => new()
    {
        SubmissionId = Guid.NewGuid(),
        PickupAddress = "12 Galle Road, Colombo 03",
        RequiredCapacityKg = requiredCapacityKg
    };

    private static CompleteJobDto ValidCompletion() => new()
    {
        PhotoUrl = "https://example.com/pickup.jpg",
        MeasuredWeightKg = 12.5m,
        Notes = "Two monitors and a printer"
    };

    // --- CreateAndAssignAsync -------------------------------------------

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateAndAssignAsync_BlankAddress_ThrowsArgumentException(string address)
    {
        var dto = NewJob();
        dto.PickupAddress = address;

        await Assert.ThrowsAsync<ArgumentException>(() => CreateJobService().CreateAndAssignAsync(dto));
        Assert.Equal(0, Geo.GeocodeCalls);
    }

    [Fact]
    public async Task CreateAndAssignAsync_AddressCannotBeGeocoded_SavesJobAsPickupLocationUnresolved()
    {
        await SeedCollectorAsync();
        Geo.GeocodeResult = null;

        var result = await CreateJobService().CreateAndAssignAsync(NewJob());

        Assert.Equal(nameof(JobStatus.PickupLocationUnresolved), result.Status);
        Assert.Null(result.CollectorId);
        Assert.Null(result.PickupLatitude);
        Assert.True(await Db.Jobs.AnyAsync(j => j.JobId == result.JobId));
        Assert.False(await Db.JobAssignmentHistory.AnyAsync(h => h.JobId == result.JobId));
    }

    [Fact]
    public async Task CreateAndAssignAsync_CollectorAvailable_AssignsNearestAndLogsHistory()
    {
        await SeedCollectorAsync(latitude: 6.91m);
        var nearest = await SeedCollectorAsync(latitude: 6.92m);
        Geo.SetDistanceFrom(6.91m, 79.8600m, (9m, 22));
        Geo.SetDistanceFrom(6.92m, 79.8600m, (2m, 6));

        var result = await CreateJobService().CreateAndAssignAsync(NewJob());

        Assert.Equal(nameof(JobStatus.Assigned), result.Status);
        Assert.Equal(nearest.CollectorId, result.CollectorId);
        Assert.Equal(PickupLat, result.PickupLatitude);
        Assert.Equal(PickupLng, result.PickupLongitude);
        Assert.Equal(2m, result.EstimatedDistanceKm);
        Assert.Equal(6, result.EstimatedEtaMinutes);

        var history = await Db.JobAssignmentHistory.SingleAsync(h => h.JobId == result.JobId);
        Assert.Equal(nearest.CollectorId, history.CollectorId);
        Assert.Equal(AssignmentOutcome.Assigned, history.Outcome);
    }

    [Fact]
    public async Task CreateAndAssignAsync_NoCollectorAvailable_SavesJobUnassigned()
    {
        await SeedCollectorAsync(isAvailable: false);

        var result = await CreateJobService().CreateAndAssignAsync(NewJob());

        Assert.Equal(nameof(JobStatus.NoCollectorAvailable), result.Status);
        Assert.Null(result.CollectorId);
        Assert.Null(result.EstimatedDistanceKm);
        Assert.True(await Db.Jobs.AnyAsync(j => j.JobId == result.JobId));
    }

    [Fact]
    public async Task CreateAndAssignAsync_RequiredCapacity_SkipsCollectorsThatAreTooSmall()
    {
        await SeedCollectorAsync(latitude: 6.91m, capacityKg: 50m);   // closer but too small
        var lorry = await SeedCollectorAsync(latitude: 6.92m, capacityKg: 2000m);
        Geo.SetDistanceFrom(6.91m, 79.8600m, (1m, 3));
        Geo.SetDistanceFrom(6.92m, 79.8600m, (10m, 25));

        var result = await CreateJobService().CreateAndAssignAsync(NewJob(requiredCapacityKg: 300m));

        Assert.Equal(lorry.CollectorId, result.CollectorId);
    }

    // --- AcceptAsync ----------------------------------------------------

    [Fact]
    public async Task AcceptAsync_AssignedToCaller_MarksAcceptedAndLogsHistory()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Assigned);

        var result = await CreateJobService().AcceptAsync(job.JobId, collector.UserId);

        Assert.Equal(nameof(JobStatus.Accepted), result.Status);
        Assert.NotNull(result.RespondedAt);
        Assert.True(await Db.JobAssignmentHistory.AnyAsync(h =>
            h.JobId == job.JobId && h.CollectorId == collector.CollectorId && h.Outcome == AssignmentOutcome.Accepted));
    }

    [Theory]
    [InlineData(JobStatus.Accepted)]
    [InlineData(JobStatus.Completed)]
    [InlineData(JobStatus.Cancelled)]
    public async Task AcceptAsync_JobNotInAssignedState_ThrowsInvalidOperation(JobStatus status)
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, status);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateJobService().AcceptAsync(job.JobId, collector.UserId));
    }

    [Fact]
    public async Task AcceptAsync_JobBelongsToAnotherCollector_ThrowsUnauthorized()
    {
        var owner = await SeedCollectorAsync();
        var other = await SeedCollectorAsync();
        var job = await SeedJobAsync(owner.CollectorId);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            CreateJobService().AcceptAsync(job.JobId, other.UserId));
    }

    [Fact]
    public async Task AcceptAsync_CallerHasNoCollectorProfile_ThrowsUnauthorized()
    {
        var owner = await SeedCollectorAsync();
        var staff = await SeedUserAsync(UserRole.Staff);
        var job = await SeedJobAsync(owner.CollectorId);

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            CreateJobService().AcceptAsync(job.JobId, staff.UserId));
    }

    [Fact]
    public async Task AcceptAsync_UnknownJob_ThrowsKeyNotFound()
    {
        var collector = await SeedCollectorAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            CreateJobService().AcceptAsync(Guid.NewGuid(), collector.UserId));
    }

    // --- RejectAsync ----------------------------------------------------

    [Fact]
    public async Task RejectAsync_AnotherCollectorAvailable_ReassignsAndRecordsRejection()
    {
        var rejecter = await SeedCollectorAsync(latitude: 6.91m);
        var backup = await SeedCollectorAsync(latitude: 6.92m);
        var job = await SeedJobAsync(rejecter.CollectorId);

        var result = await CreateJobService().RejectAsync(job.JobId, rejecter.UserId,
            new RejectJobDto { Reason = "Vehicle broke down" });

        Assert.Equal(nameof(JobStatus.Assigned), result.Status);
        Assert.Equal(backup.CollectorId, result.CollectorId);
        Assert.Null(result.RejectionReason);   // cleared on reassignment; history keeps it

        var rejection = await Db.JobAssignmentHistory.SingleAsync(h =>
            h.JobId == job.JobId && h.Outcome == AssignmentOutcome.Rejected);
        Assert.Equal(rejecter.CollectorId, rejection.CollectorId);
        Assert.Equal("Vehicle broke down", rejection.Reason);

        Assert.True(await Db.JobAssignmentHistory.AnyAsync(h =>
            h.JobId == job.JobId && h.CollectorId == backup.CollectorId && h.Outcome == AssignmentOutcome.Assigned));
    }

    [Fact]
    public async Task RejectAsync_NoOtherCollector_MarksNoCollectorAvailable()
    {
        var rejecter = await SeedCollectorAsync();
        var job = await SeedJobAsync(rejecter.CollectorId);

        var result = await CreateJobService().RejectAsync(job.JobId, rejecter.UserId, new RejectJobDto());

        Assert.Equal(nameof(JobStatus.NoCollectorAvailable), result.Status);
        Assert.Null(result.CollectorId);
    }

    [Fact]
    public async Task RejectAsync_SecondRejection_NeverOffersJobBackToEarlierRejecter()
    {
        var first = await SeedCollectorAsync(latitude: 6.91m);
        var second = await SeedCollectorAsync(latitude: 6.92m);
        var job = await SeedJobAsync(first.CollectorId);
        var service = CreateJobService();

        var afterFirst = await service.RejectAsync(job.JobId, first.UserId, new RejectJobDto { Reason = "Busy" });
        Assert.Equal(second.CollectorId, afterFirst.CollectorId);

        var afterSecond = await service.RejectAsync(job.JobId, second.UserId, new RejectJobDto { Reason = "Too far" });

        Assert.Equal(nameof(JobStatus.NoCollectorAvailable), afterSecond.Status);
        Assert.Null(afterSecond.CollectorId);
    }

    [Fact]
    public async Task RejectAsync_AlreadyAccepted_ThrowsInvalidOperation()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Accepted);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateJobService().RejectAsync(job.JobId, collector.UserId, new RejectJobDto()));
    }

    // --- CompleteAsync --------------------------------------------------

    [Theory]
    [InlineData(JobStatus.Accepted)]
    [InlineData(JobStatus.InProgress)]
    public async Task CompleteAsync_AcceptedOrInProgress_StoresEvidenceAndCompletes(JobStatus status)
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, status);

        var result = await CreateJobService().CompleteAsync(job.JobId, collector.UserId, ValidCompletion());

        Assert.Equal(nameof(JobStatus.Completed), result.Status);
        Assert.Equal("https://example.com/pickup.jpg", result.PhotoUrl);
        Assert.Equal(12.5m, result.MeasuredWeightKg);
        Assert.Equal("Two monitors and a printer", result.Notes);
        Assert.NotNull(result.CompletedAt);
    }

    [Fact]
    public async Task CompleteAsync_StillAssigned_ThrowsInvalidOperation()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Assigned);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CreateJobService().CompleteAsync(job.JobId, collector.UserId, ValidCompletion()));
    }

    [Fact]
    public async Task CompleteAsync_MissingPhoto_ThrowsArgumentException()
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Accepted);
        var dto = ValidCompletion();
        dto.PhotoUrl = "";

        await Assert.ThrowsAsync<ArgumentException>(() =>
            CreateJobService().CompleteAsync(job.JobId, collector.UserId, dto));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-3)]
    public async Task CompleteAsync_NonPositiveWeight_ThrowsArgumentException(int weight)
    {
        var collector = await SeedCollectorAsync();
        var job = await SeedJobAsync(collector.CollectorId, JobStatus.Accepted);
        var dto = ValidCompletion();
        dto.MeasuredWeightKg = weight;

        await Assert.ThrowsAsync<ArgumentException>(() =>
            CreateJobService().CompleteAsync(job.JobId, collector.UserId, dto));
    }

    // --- Queries --------------------------------------------------------

    [Fact]
    public async Task GetMyJobsAsync_ReturnsOnlyCallersJobs_NewestFirst_AndFiltersByStatus()
    {
        var me = await SeedCollectorAsync();
        var someoneElse = await SeedCollectorAsync();
        var older = await SeedJobAsync(me.CollectorId, JobStatus.Completed, createdAt: DateTime.UtcNow.AddDays(-2));
        var newer = await SeedJobAsync(me.CollectorId, JobStatus.Accepted, createdAt: DateTime.UtcNow.AddDays(-1));
        await SeedJobAsync(someoneElse.CollectorId);
        var service = CreateJobService();

        var all = await service.GetMyJobsAsync(me.UserId, status: null);
        var completedOnly = await service.GetMyJobsAsync(me.UserId, JobStatus.Completed);

        Assert.Equal(new[] { newer.JobId, older.JobId }, all.Select(j => j.JobId).ToArray());
        var completed = Assert.Single(completedOnly);
        Assert.Equal(older.JobId, completed.JobId);
    }

    [Fact]
    public async Task GetMyJobsAsync_NoCollectorProfile_ThrowsKeyNotFound()
    {
        var user = await SeedUserAsync();

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            CreateJobService().GetMyJobsAsync(user.UserId, null));
    }

    [Fact]
    public async Task GetByIdAsync_RespectsOwnershipUnlessPrivileged()
    {
        var owner = await SeedCollectorAsync();
        var other = await SeedCollectorAsync();
        var staff = await SeedUserAsync(UserRole.Staff);
        var job = await SeedJobAsync(owner.CollectorId);
        var service = CreateJobService();

        Assert.NotNull(await service.GetByIdAsync(job.JobId, owner.UserId, isPrivileged: false));
        Assert.NotNull(await service.GetByIdAsync(job.JobId, staff.UserId, isPrivileged: true));
        await Assert.ThrowsAsync<UnauthorizedAccessException>(() =>
            service.GetByIdAsync(job.JobId, other.UserId, isPrivileged: false));
        Assert.Null(await service.GetByIdAsync(Guid.NewGuid(), staff.UserId, isPrivileged: true));
    }

    [Fact]
    public async Task GetAllAsync_FiltersByStatus()
    {
        var collector = await SeedCollectorAsync();
        await SeedJobAsync(collector.CollectorId, JobStatus.Assigned);
        await SeedJobAsync(collector.CollectorId, JobStatus.Completed);
        await SeedJobAsync(null, JobStatus.NoCollectorAvailable);
        var service = CreateJobService();

        Assert.Equal(3, (await service.GetAllAsync(null)).Count);
        var unassigned = Assert.Single(await service.GetAllAsync(JobStatus.NoCollectorAvailable));
        Assert.Null(unassigned.CollectorId);
    }
}
