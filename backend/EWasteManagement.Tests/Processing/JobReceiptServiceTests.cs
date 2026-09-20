using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Exceptions;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class JobReceiptServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<Guid> SeedLocationAsync()
    {
        var location = new WarehouseLocation { Name = "Receiving Bay" };
        _db.WarehouseLocations.Add(location);
        await _db.SaveChangesAsync();
        return location.Id;
    }

    private async Task<Guid> SeedCollectorAsync()
    {
        var user = new User { Email = $"{Guid.NewGuid()}@test.com", FullName = "Test Collector", PasswordHash = "x", Role = UserRole.Collector };
        var collector = new Collector { UserId = user.UserId, VehicleType = "Van", CapacityKg = 500 };
        _db.Users.Add(user);
        _db.Collectors.Add(collector);
        await _db.SaveChangesAsync();
        return collector.CollectorId;
    }

    private JobReceiptService CreateService(JobVerificationResult verification)
    {
        var rates = new RatePolicyLookupService(_db);
        var calculators = new IPaymentCalculator[] { new JobPaymentCalculator(rates), new ExtraWastePaymentCalculator(rates) };
        var paymentService = new CollectorPaymentService(_db, calculators);
        return new JobReceiptService(_db, new FakeJobVerificationService(verification), paymentService);
    }

    [Fact]
    public async Task ReceiveAsync_CompletedJobWithDistance_CreatesInventoryItemAndPayment()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService(new JobVerificationResult(true, true, ReportedWeightKg: 10.0m, DistanceKm: 5m));

        var result = await service.ReceiveAsync(new ReceiveJobWasteRequest
        {
            JobId = Guid.NewGuid(), CollectorId = collectorId,
            WarehouseLocationId = locationId, VerifiedWeightKg = 9.5m
        }, Guid.NewGuid());

        Assert.Equal(-0.5m, result.DiscrepancyKg);

        var payment = await _db.CollectorPayments.SingleAsync(p => p.SourceId == result.JobId);
        // 200 base + 9.5kg * 20/kg (GeneralCollection) + 5km * 15/km = 200 + 190 + 75 = 465.00
        Assert.Equal(465.00m, payment.Amount);
    }

    [Fact]
    public async Task ReceiveAsync_JobNotCompleted_ThrowsAndCreatesNoInventoryItemOrPayment()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService(new JobVerificationResult(true, false, null));

        var request = new ReceiveJobWasteRequest
        {
            JobId = Guid.NewGuid(), CollectorId = collectorId,
            WarehouseLocationId = locationId, VerifiedWeightKg = 5m
        };

        await Assert.ThrowsAsync<JobNotCompletedException>(() => service.ReceiveAsync(request, Guid.NewGuid()));
        Assert.Equal(0, await _db.InventoryItems.CountAsync());
        Assert.Equal(0, await _db.CollectorPayments.CountAsync());
    }

    [Fact]
    public async Task ReceiveAsync_SameJobTwice_SecondCallThrowsDuplicateException()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService(new JobVerificationResult(true, true, null));
        var request = new ReceiveJobWasteRequest
        {
            JobId = Guid.NewGuid(), CollectorId = collectorId,
            WarehouseLocationId = locationId, VerifiedWeightKg = 5m
        };

        await service.ReceiveAsync(request, Guid.NewGuid());

        await Assert.ThrowsAsync<DuplicateJobReceiptException>(() => service.ReceiveAsync(request, Guid.NewGuid()));
    }

    [Fact]
    public async Task ReceiveAsync_UnknownCollector_ThrowsNotFoundAndCreatesNoInventoryItemOrPayment()
    {
        var locationId = await SeedLocationAsync();
        var service = CreateService(new JobVerificationResult(true, true, null));

        var request = new ReceiveJobWasteRequest
        {
            JobId = Guid.NewGuid(), CollectorId = Guid.NewGuid(),
            WarehouseLocationId = locationId, VerifiedWeightKg = 5m
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ReceiveAsync(request, Guid.NewGuid()));
        Assert.Equal(0, await _db.InventoryItems.CountAsync());
        Assert.Equal(0, await _db.CollectorPayments.CountAsync());
    }
}