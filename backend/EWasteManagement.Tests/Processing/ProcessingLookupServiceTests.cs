using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class ProcessingLookupServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private ProcessingLookupService _lookups = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();
        _lookups = new ProcessingLookupService(_db);
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); await _connection.DisposeAsync(); }

    private async Task<Guid> SeedCollectorAsync(string fullName, string vehicle, bool isActive = true, bool isDeleted = false)
    {
        var user = new User
        {
            Email = $"{Guid.NewGuid()}@test.com", FullName = fullName, PasswordHash = "secret-hash",
            Role = UserRole.Collector, IsActive = isActive, IsDeleted = isDeleted
        };
        var collector = new Collector { UserId = user.UserId, VehicleType = vehicle, CapacityKg = 500 };
        _db.Users.Add(user);
        _db.Collectors.Add(collector);
        await _db.SaveChangesAsync();
        return collector.CollectorId;
    }

    [Fact]
    public async Task GetWarehouseLocationsAsync_ReturnsTheSeededLocations()
    {
        var result = await _lookups.GetWarehouseLocationsAsync();

        Assert.Contains(result, l => l.Name == "Receiving Bay");
        Assert.Contains(result, l => l.Name == "Sorting Area");
        Assert.All(result, l => Assert.NotEqual(Guid.Empty, l.Id));
    }

    [Fact]
    public async Task GetRatePoliciesAsync_ActiveOnly_ExcludesInactivePolicies()
    {
        _db.RatePolicies.Add(new RatePolicy { ItemType = "Old Item", RatePerKg = 1m, IsActive = false });
        await _db.SaveChangesAsync();

        var active = await _lookups.GetRatePoliciesAsync(activeOnly: true);
        var all = await _lookups.GetRatePoliciesAsync(activeOnly: false);

        Assert.DoesNotContain(active, r => r.ItemType == "Old Item");
        Assert.Contains(all, r => r.ItemType == "Old Item");
        Assert.Contains(active, r => r.ItemType == "Laptop" && r.RatePerKg == 50m);
        Assert.Equal(active.Select(r => r.ItemType).OrderBy(t => t, StringComparer.Ordinal), active.Select(r => r.ItemType));
    }

    [Fact]
    public async Task GetCollectorsAsync_ReturnsNameAndVehicle_OrderedByName_SkippingInactiveOrDeletedUsers()
    {
        var zed = await SeedCollectorAsync("Zed Collector", "Truck");
        var amy = await SeedCollectorAsync("Amy Collector", "Van");
        await SeedCollectorAsync("Inactive Collector", "Van", isActive: false);
        await SeedCollectorAsync("Deleted Collector", "Van", isDeleted: true);

        var result = await _lookups.GetCollectorsAsync();

        Assert.Equal(new[] { amy, zed }, result.Select(c => c.CollectorId));
        Assert.Equal(new[] { "Amy Collector", "Zed Collector" }, result.Select(c => c.FullName));
        Assert.Equal("Van", result[0].VehicleType);
    }
}
