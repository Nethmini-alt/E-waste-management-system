using EWasteManagement.API.Features.Collection.Controllers;
using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.Tests.TestHelpers;
using static EWasteManagement.Tests.TestHelpers.ControllerTestExtensions;

namespace EWasteManagement.Tests.Collection;

// Calls each CollectorsController action directly, with a fake logged-in user,
// against the real services + SQLite. Checks the HTTP status each endpoint
// returns for the success and error paths. (Routing and [Authorize] role
// checks are enforced by ASP.NET middleware, which these tests don't run.)
public class CollectorsControllerTests : CollectionTestBase
{
    private CollectorsController Controller(Guid userId, string role = "Collector")
        => new CollectorsController(CreateCollectorService(), CreateMatchingService()).WithUser(userId, role);

    [Fact]
    public async Task CreateProfile_Returns201_Then409OnSecondAttempt()
    {
        var user = await SeedUserAsync();
        var dto = new CreateCollectorProfileDto { VehicleType = "Van", CapacityKg = 400m };

        var first = await Controller(user.UserId).CreateProfile(dto);
        var second = await Controller(user.UserId).CreateProfile(dto);

        Assert.Equal(201, StatusCodeOf(first));
        Assert.Equal(user.UserId, ValueOf(first).UserId);
        Assert.Equal(409, StatusCodeOf(second));
    }

    [Fact]
    public async Task CreateProfile_InvalidInput_Returns400()
    {
        var user = await SeedUserAsync();

        var result = await Controller(user.UserId).CreateProfile(
            new CreateCollectorProfileDto { VehicleType = "", CapacityKg = 400m });

        Assert.Equal(400, StatusCodeOf(result));
    }

    [Fact]
    public async Task GetMe_Returns404WithoutProfile_And200WithProfile()
    {
        var noProfile = await SeedUserAsync();
        var collector = await SeedCollectorAsync();

        Assert.Equal(404, StatusCodeOf(await Controller(noProfile.UserId).GetMe()));

        var found = await Controller(collector.UserId).GetMe();
        Assert.Equal(200, StatusCodeOf(found));
        Assert.Equal(collector.CollectorId, ValueOf(found).CollectorId);
    }

    [Fact]
    public async Task GetById_Returns200ForExisting_And404ForUnknown()
    {
        var collector = await SeedCollectorAsync();
        var staffId = Guid.NewGuid();

        Assert.Equal(200, StatusCodeOf(await Controller(staffId, "Staff").GetById(collector.CollectorId)));
        Assert.Equal(404, StatusCodeOf(await Controller(staffId, "Staff").GetById(Guid.NewGuid())));
    }

    [Fact]
    public async Task UpdateAvailability_Returns200ForOwner_403ForOthers_404ForUnknown()
    {
        var collector = await SeedCollectorAsync(isAvailable: false);
        var intruder = await SeedUserAsync();
        var dto = new UpdateAvailabilityDto { IsAvailable = true };

        var ok = await Controller(collector.UserId).UpdateAvailability(collector.CollectorId, dto);
        var forbidden = await Controller(intruder.UserId).UpdateAvailability(collector.CollectorId, dto);
        var missing = await Controller(collector.UserId).UpdateAvailability(Guid.NewGuid(), dto);

        Assert.Equal(200, StatusCodeOf(ok));
        Assert.True(ValueOf(ok).IsAvailable);
        Assert.Equal(403, StatusCodeOf(forbidden));
        Assert.Equal(404, StatusCodeOf(missing));
    }

    [Fact]
    public async Task UpdateLocation_Returns200ForOwner_And403ForOthers()
    {
        var collector = await SeedCollectorAsync(hasLocation: false);
        var intruder = await SeedUserAsync();
        var dto = new UpdateLocationDto { Latitude = 6.95m, Longitude = 79.87m };

        var ok = await Controller(collector.UserId).UpdateLocation(collector.CollectorId, dto);
        var forbidden = await Controller(intruder.UserId).UpdateLocation(collector.CollectorId, dto);

        Assert.Equal(200, StatusCodeOf(ok));
        Assert.Equal(6.95m, ValueOf(ok).CurrentLatitude);
        Assert.Equal(403, StatusCodeOf(forbidden));
    }

    [Fact]
    public async Task Match_And_GetAvailable_Return200WithRankedCandidates()
    {
        var near = await SeedCollectorAsync(latitude: 6.91m);
        await SeedCollectorAsync(latitude: 6.92m);
        Geo.SetDistanceFrom(6.91m, 79.8600m, (1m, 4));
        Geo.SetDistanceFrom(6.92m, 79.8600m, (6m, 15));
        var request = new MatchRequestDto { PickupLatitude = PickupLat, PickupLongitude = PickupLng };

        var match = await Controller(Guid.NewGuid(), "Staff").Match(request);
        var available = await Controller(Guid.NewGuid(), "Staff").GetAvailable(request);

        Assert.Equal(200, StatusCodeOf(match));
        Assert.Equal(2, ValueOf(match).Count);
        Assert.Equal(near.CollectorId, ValueOf(match)[0].CollectorId);
        Assert.Equal(200, StatusCodeOf(available));
        Assert.Equal(2, ValueOf(available).Count);
    }
}
