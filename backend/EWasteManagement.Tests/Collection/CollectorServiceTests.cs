using EWasteManagement.API.Features.Collection.DTOs;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.Tests.Collection;

public class CollectorServiceTests : CollectionTestBase
{
    // --- CreateProfileAsync ---------------------------------------------

    [Fact]
    public async Task CreateProfileAsync_ValidInput_CreatesUnavailableProfileWithDefaultRating()
    {
        var user = await SeedUserAsync();
        var service = CreateCollectorService();

        var result = await service.CreateProfileAsync(user.UserId,
            new CreateCollectorProfileDto { VehicleType = "Lorry", CapacityKg = 1500m });

        Assert.Equal(user.UserId, result.UserId);
        Assert.Equal("Lorry", result.VehicleType);
        Assert.Equal(1500m, result.CapacityKg);
        Assert.False(result.IsAvailable);          // collectors start off-shift
        Assert.Equal(5.0m, result.Rating);
        Assert.Null(result.CurrentLatitude);

        Assert.True(await Db.Collectors.AnyAsync(c => c.CollectorId == result.CollectorId));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task CreateProfileAsync_BlankVehicleType_ThrowsArgumentException(string vehicleType)
    {
        var user = await SeedUserAsync();
        var service = CreateCollectorService();

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateProfileAsync(user.UserId,
            new CreateCollectorProfileDto { VehicleType = vehicleType, CapacityKg = 100m }));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public async Task CreateProfileAsync_NonPositiveCapacity_ThrowsArgumentException(int capacity)
    {
        var user = await SeedUserAsync();
        var service = CreateCollectorService();

        await Assert.ThrowsAsync<ArgumentException>(() => service.CreateProfileAsync(user.UserId,
            new CreateCollectorProfileDto { VehicleType = "Van", CapacityKg = capacity }));
    }

    [Fact]
    public async Task CreateProfileAsync_ProfileAlreadyExists_ThrowsInvalidOperation()
    {
        var existing = await SeedCollectorAsync();
        var service = CreateCollectorService();

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateProfileAsync(existing.UserId,
            new CreateCollectorProfileDto { VehicleType = "Van", CapacityKg = 100m }));

        Assert.Equal(1, await Db.Collectors.CountAsync(c => c.UserId == existing.UserId));
    }

    // --- Get ------------------------------------------------------------

    [Fact]
    public async Task GetByUserIdAsync_ReturnsProfileOrNull()
    {
        var collector = await SeedCollectorAsync();
        var userWithoutProfile = await SeedUserAsync();
        var service = CreateCollectorService();

        var found = await service.GetByUserIdAsync(collector.UserId);
        var missing = await service.GetByUserIdAsync(userWithoutProfile.UserId);

        Assert.NotNull(found);
        Assert.Equal(collector.CollectorId, found!.CollectorId);
        Assert.Null(missing);
    }

    [Fact]
    public async Task GetByIdAsync_UnknownId_ReturnsNull()
    {
        var service = CreateCollectorService();

        Assert.Null(await service.GetByIdAsync(Guid.NewGuid()));
    }

    // --- UpdateAvailabilityAsync ----------------------------------------

    [Fact]
    public async Task UpdateAvailabilityAsync_Owner_UpdatesFlag()
    {
        var collector = await SeedCollectorAsync(isAvailable: false);
        var service = CreateCollectorService();

        var result = await service.UpdateAvailabilityAsync(collector.CollectorId, collector.UserId,
            new UpdateAvailabilityDto { IsAvailable = true });

        Assert.True(result.IsAvailable);
        Assert.True((await Db.Collectors.SingleAsync(c => c.CollectorId == collector.CollectorId)).IsAvailable);
    }

    [Fact]
    public async Task UpdateAvailabilityAsync_DifferentUser_ThrowsUnauthorizedAndLeavesProfileUnchanged()
    {
        var collector = await SeedCollectorAsync(isAvailable: false);
        var intruder = await SeedUserAsync();
        var service = CreateCollectorService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.UpdateAvailabilityAsync(
            collector.CollectorId, intruder.UserId, new UpdateAvailabilityDto { IsAvailable = true }));

        Assert.False((await Db.Collectors.SingleAsync(c => c.CollectorId == collector.CollectorId)).IsAvailable);
    }

    [Fact]
    public async Task UpdateAvailabilityAsync_UnknownCollector_ThrowsKeyNotFound()
    {
        var service = CreateCollectorService();

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.UpdateAvailabilityAsync(
            Guid.NewGuid(), Guid.NewGuid(), new UpdateAvailabilityDto { IsAvailable = true }));
    }

    // --- UpdateLocationAsync --------------------------------------------

    [Fact]
    public async Task UpdateLocationAsync_Owner_SetsCoordinatesAndTimestamp()
    {
        var collector = await SeedCollectorAsync(hasLocation: false);
        var service = CreateCollectorService();
        var before = DateTime.UtcNow.AddSeconds(-1);

        var result = await service.UpdateLocationAsync(collector.CollectorId, collector.UserId,
            new UpdateLocationDto { Latitude = 7.2906m, Longitude = 80.6337m });

        Assert.Equal(7.2906m, result.CurrentLatitude);
        Assert.Equal(80.6337m, result.CurrentLongitude);
        Assert.NotNull(result.LocationUpdatedAt);
        Assert.True(result.LocationUpdatedAt >= before);
    }

    [Fact]
    public async Task UpdateLocationAsync_DifferentUser_ThrowsUnauthorized()
    {
        var collector = await SeedCollectorAsync();
        var intruder = await SeedUserAsync();
        var service = CreateCollectorService();

        await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.UpdateLocationAsync(
            collector.CollectorId, intruder.UserId, new UpdateLocationDto { Latitude = 1m, Longitude = 1m }));
    }
}
