using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Collection.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.Tests.Collection;

// Same setup as the Processing tests (in-memory SQLite, schema via
// EnsureCreated), pulled into a base class because every Collection test
// class needs the same users/collectors/jobs seeding.
public abstract class CollectionTestBase : IAsyncLifetime
{
    protected const decimal PickupLat = 6.9271m;
    protected const decimal PickupLng = 79.8612m;

    private SqliteConnection _connection = null!;
    protected ApplicationDbContext Db = null!;
    protected FakeGeoService Geo = new();

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        Db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await Db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await Db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    // --- services -----------------------------------------------------

    protected CollectorService CreateCollectorService() => new(Db);
    protected MatchingService CreateMatchingService() => new(Db, Geo);
    protected JobService CreateJobService() => new(Db, Geo, CreateMatchingService());

    // --- seeding ------------------------------------------------------

    protected async Task<User> SeedUserAsync(UserRole role = UserRole.Collector)
    {
        var user = new User
        {
            Email = $"{Guid.NewGuid()}@test.com",
            FullName = "Test User",
            PasswordHash = "x",
            Role = role
        };
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        return user;
    }

    // Collectors have an FK to Users, so a user is created for each one unless
    // an existing userId is passed in.
    protected async Task<Collector> SeedCollectorAsync(
        bool isAvailable = true,
        bool hasLocation = true,
        decimal latitude = 6.9000m,
        decimal longitude = 79.8600m,
        decimal capacityKg = 500m,
        decimal rating = 5.0m,
        Guid? userId = null)
    {
        var ownerId = userId ?? (await SeedUserAsync()).UserId;

        var collector = new Collector
        {
            UserId = ownerId,
            VehicleType = "Van",
            CapacityKg = capacityKg,
            Rating = rating,
            IsAvailable = isAvailable,
            CurrentLatitude = hasLocation ? latitude : (decimal?)null,
            CurrentLongitude = hasLocation ? longitude : (decimal?)null,
            LocationUpdatedAt = hasLocation ? DateTime.UtcNow : (DateTime?)null
        };
        Db.Collectors.Add(collector);
        await Db.SaveChangesAsync();
        return collector;
    }

    protected async Task<Job> SeedJobAsync(
        Guid? collectorId,
        JobStatus status = JobStatus.Assigned,
        DateTime? createdAt = null,
        bool hasLocation = true)
    {
        var job = new Job
        {
            SubmissionId = Guid.NewGuid(),
            CollectorId = collectorId,
            Status = status,
            PickupAddress = "12 Galle Road, Colombo 03",
            PickupLatitude = hasLocation ? PickupLat : (decimal?)null,
            PickupLongitude = hasLocation ? PickupLng : (decimal?)null,
            CreatedAt = createdAt ?? DateTime.UtcNow
        };
        Db.Jobs.Add(job);
        await Db.SaveChangesAsync();
        return job;
    }
}
