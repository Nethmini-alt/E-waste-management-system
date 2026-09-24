using EWasteManagement.API.Features.Collection.Controllers;
using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.Tests.TestHelpers;
using static EWasteManagement.Tests.TestHelpers.ControllerTestExtensions;

namespace EWasteManagement.Tests.Collection;

// Same approach as CollectorsControllerTests: each JobsController action is
// called as a fake logged-in user, and the returned HTTP status is checked.
public class JobsControllerTests : CollectionTestBase
{
    private JobsController Controller(Guid userId, string role = "Collector")
        => new JobsController(CreateJobService()).WithUser(userId, role);

    private static CompleteJobDto ValidCompletion() => new()
    {
        PhotoUrl = "https://example.com/pickup.jpg",
        MeasuredWeightKg = 8m
    };

    [Fact]
    public async Task Assign_Returns201WithAssignedJob()
    {
        var collector = await SeedCollectorAsync();

        var result = await Controller(Guid.NewGuid(), "Staff").Assign(new CreateJobDto
        {
            SubmissionId = Guid.NewGuid(),
            PickupAddress = "45 Duplication Road, Colombo 04"
        });

        Assert.Equal(201, StatusCodeOf(result));
        Assert.Equal(collector.CollectorId, ValueOf(result).CollectorId);
        Assert.Equal(nameof(JobStatus.Assigned), ValueOf(result).Status);
    }

    [Fact]
    public async Task Assign_BlankAddress_Returns400()
    {
        var result = await Controller(Guid.NewGuid(), "Staff").Assign(new CreateJobDto
        {
            SubmissionId = Guid.NewGuid(),
            PickupAddress = " "
        });

        Assert.Equal(400, StatusCodeOf(result));
    }

    [Fact]
    public async Task GetMy_Returns200ForCollector_And404WithoutProfile()
    {
        var collector = await SeedCollectorAsync();
        await SeedJobAsync(collector.CollectorId);
        var noProfile = await SeedUserAsync();

        var ok = await Controller(collector.UserId).GetMy(null);
        var missing = await Controller(noProfile.UserId).GetMy(null);

        Assert.Equal(200, StatusCodeOf(ok));
        Assert.Single(ValueOf(ok));
        Assert.Equal(404, StatusCodeOf(missing));
    }

    [Fact]
    public async Task GetById_Returns200ForOwnerAndStaff_403ForOtherCollector_404ForUnknown()
    {
        var owner = await SeedCollectorAsync();
        var other = await SeedCollectorAsync();
        var job = await SeedJobAsync(owner.CollectorId);

        Assert.Equal(200, StatusCodeOf(await Controller(owner.UserId).GetById(job.JobId)));
        Assert.Equal(200, StatusCodeOf(await Controller(Guid.NewGuid(), "Staff").GetById(job.JobId)));
        Assert.Equal(200, StatusCodeOf(await Controller(Guid.NewGuid(), "Admin").GetById(job.JobId)));
        Assert.Equal(403, StatusCodeOf(await Controller(other.UserId).GetById(job.JobId)));
        Assert.Equal(404, StatusCodeOf(await Controller(Guid.NewGuid(), "Staff").GetById(Guid.NewGuid())));
    }

    [Fact]
    public async Task GetAll_Returns200AndFiltersByStatus()
    {
        var collector = await SeedCollectorAsync();
        await SeedJobAsync(collector.CollectorId, JobStatus.Assigned);
        await SeedJobAsync(collector.CollectorId, JobStatus.Completed);

        var result = await Controller(Guid.NewGuid(), "Staff").GetAll(JobStatus.Completed);

        Assert.Equal(200, StatusCodeOf(result));
        Assert.Single(ValueOf(result));
    }

    [Fact]
    public async Task Accept_Returns200_409_403_404()
    {
        var owner = await SeedCollectorAsync();
        var other = await SeedCollectorAsync();
        var job = await SeedJobAsync(owner.CollectorId);

        var forbidden = await Controller(other.UserId).Accept(job.JobId);
        var ok = await Controller(owner.UserId).Accept(job.JobId);
        var conflict = await Controller(owner.UserId).Accept(job.JobId);   // already accepted
        var missing = await Controller(owner.UserId).Accept(Guid.NewGuid());

        Assert.Equal(403, StatusCodeOf(forbidden));
        Assert.Equal(200, StatusCodeOf(ok));
        Assert.Equal(nameof(JobStatus.Accepted), ValueOf(ok).Status);
        Assert.Equal(409, StatusCodeOf(conflict));
        Assert.Equal(404, StatusCodeOf(missing));
    }

    [Fact]
    public async Task Reject_Returns200WithReassignedJob_Then403ForOriginalCollector()
    {
        var rejecter = await SeedCollectorAsync(latitude: 6.91m);
        var backup = await SeedCollectorAsync(latitude: 6.92m);
        var job = await SeedJobAsync(rejecter.CollectorId);

        var ok = await Controller(rejecter.UserId).Reject(job.JobId, new RejectJobDto { Reason = "Off sick" });
        // The job now belongs to the backup collector, so the rejecter can no longer act on it.
        var forbidden = await Controller(rejecter.UserId).Reject(job.JobId, new RejectJobDto());

        Assert.Equal(200, StatusCodeOf(ok));
        Assert.Equal(backup.CollectorId, ValueOf(ok).CollectorId);
        Assert.Equal(403, StatusCodeOf(forbidden));
    }

    [Fact]
    public async Task Complete_Returns409WhenNotAccepted_400ForBadInput_200WhenValid()
    {
        var collector = await SeedCollectorAsync();
        var assignedJob = await SeedJobAsync(collector.CollectorId, JobStatus.Assigned);
        var acceptedJob = await SeedJobAsync(collector.CollectorId, JobStatus.Accepted);
        var badInput = ValidCompletion();
        badInput.MeasuredWeightKg = 0m;

        var conflict = await Controller(collector.UserId).Complete(assignedJob.JobId, ValidCompletion());
        var badRequest = await Controller(collector.UserId).Complete(acceptedJob.JobId, badInput);
        var ok = await Controller(collector.UserId).Complete(acceptedJob.JobId, ValidCompletion());

        Assert.Equal(409, StatusCodeOf(conflict));
        Assert.Equal(400, StatusCodeOf(badRequest));
        Assert.Equal(200, StatusCodeOf(ok));
        Assert.Equal(nameof(JobStatus.Completed), ValueOf(ok).Status);
    }
}
