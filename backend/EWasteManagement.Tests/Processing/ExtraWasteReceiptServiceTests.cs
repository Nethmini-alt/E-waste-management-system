using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class ExtraWasteReceiptServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;

    private ExtraWasteReceiptService CreateService()
{
    var rates = new RatePolicyLookupService(_db);
    var calculators = new IPaymentCalculator[] { new JobPaymentCalculator(rates), new ExtraWastePaymentCalculator(rates) };
    return new ExtraWasteReceiptService(_db, new CollectorPaymentService(_db, calculators));
}

    public async Task InitializeAsync()
    {
        // Kept open for the test's lifetime — SQLite's in-memory DB disappears the moment
        // the last connection to it closes.
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite(_connection)
            .Options;

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

    [Fact]
    public async Task ReceiveAsync_MixedAcceptedAndRejected_OnlyAcceptedCreateInventoryItems()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService();

        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = collectorId,
            WarehouseLocationId = locationId,
            Items =
            {
                new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 3.2m, Accepted = true },
                new ReceiveExtraWasteItemRequest { ItemType = "Broken CRT Monitor", WeightKg = 8.5m, Accepted = false, RejectionReason = "Not accepted at this site" }
            }
        };

        var result = await service.ReceiveAsync(request, Guid.NewGuid());

        Assert.Equal(2, result.Items.Count);
        Assert.NotNull(result.Items.Single(i => i.ItemType == "Laptop").InventoryItemId);
        Assert.Null(result.Items.Single(i => i.ItemType == "Broken CRT Monitor").InventoryItemId);
        Assert.Equal(1, await _db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task ReceiveAsync_RejectedItemWithNoReason_IsRejectedByValidatorBeforeReachingService()
    {
        var validator = new ReceiveExtraWasteRequestValidator();
        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = Guid.NewGuid(),
            WarehouseLocationId = Guid.NewGuid(),
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 3.2m, Accepted = false } }
        };

        var validationResult = await validator.ValidateAsync(request);

        Assert.False(validationResult.IsValid);
    }

    [Fact]
    public async Task ReceiveAsync_SameIdempotencyKeyTwice_DoesNotCreateASecondReceipt()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService();
        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = collectorId,
            WarehouseLocationId = locationId,
            IdempotencyKey = "receipt-key-001",
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 3.2m, Accepted = true } }
        };

        var first = await service.ReceiveAsync(request, Guid.NewGuid());
        var second = await service.ReceiveAsync(request, Guid.NewGuid());

        Assert.Equal(first.ExtraWasteReceiptId, second.ExtraWasteReceiptId);
        Assert.Equal(1, await _db.ExtraWasteReceipts.CountAsync());
    }

    [Fact]
    public async Task ReceiveAsync_AcceptedItems_CreatesOneCollectorPaymentForTheWholeReceipt()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService();

        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = collectorId,
            WarehouseLocationId = locationId,
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 3.2m, Accepted = true } }
        };

        var result = await service.ReceiveAsync(request, Guid.NewGuid());

        var payment = await _db.CollectorPayments.SingleAsync(p => p.SourceId == result.ExtraWasteReceiptId);
        Assert.Equal(160.00m, payment.Amount);
        Assert.Equal(PaymentStatus.Pending, payment.Status);
    }

    [Fact]
    public async Task ReceiveAsync_ItemTypeInDifferentCase_MatchesRatePolicyAndStoresCanonicalName()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService();

        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = collectorId,
            WarehouseLocationId = locationId,
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "laptop", WeightKg = 3.2m, Accepted = true } }
        };

        var result = await service.ReceiveAsync(request, Guid.NewGuid());

        var inventoryItem = await _db.InventoryItems.SingleAsync();
        Assert.Equal("Laptop", inventoryItem.ItemType);
        Assert.Equal("Laptop", result.Items.Single().ItemType);
        Assert.Equal(result.ExtraWasteReceiptId, inventoryItem.ExtraWasteReceiptId);
        var payment = await _db.CollectorPayments.SingleAsync(p => p.SourceId == result.ExtraWasteReceiptId);
        Assert.Equal(160.00m, payment.Amount);
    }

    [Fact]
    public async Task ReceiveAsync_UnknownCollector_ThrowsNotFoundAndCreatesNothing()
    {
        var locationId = await SeedLocationAsync();
        var service = CreateService();

        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = Guid.NewGuid(),
            WarehouseLocationId = locationId,
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 3.2m, Accepted = true } }
        };

        await Assert.ThrowsAsync<KeyNotFoundException>(() => service.ReceiveAsync(request, Guid.NewGuid()));
        Assert.Equal(0, await _db.ExtraWasteReceipts.CountAsync());
        Assert.Equal(0, await _db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task ReceiveAsync_AcceptedItemWithNoRatePolicy_ThrowsArgumentExceptionAndCreatesNothing()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService();

        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = collectorId,
            WarehouseLocationId = locationId,
            Items =
            {
                new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 3.2m, Accepted = true },
                new ReceiveExtraWasteItemRequest { ItemType = "Toaster", WeightKg = 1m, Accepted = true }
            }
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => service.ReceiveAsync(request, Guid.NewGuid()));
        Assert.Contains("Toaster", ex.Message);
        Assert.Equal(0, await _db.ExtraWasteReceipts.CountAsync());
        Assert.Equal(0, await _db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task ReceiveAsync_RejectedItemWithNoRatePolicy_IsStillAllowed()
    {
        var locationId = await SeedLocationAsync();
        var collectorId = await SeedCollectorAsync();
        var service = CreateService();

        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = collectorId,
            WarehouseLocationId = locationId,
            Items =
            {
                new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 3.2m, Accepted = true },
                new ReceiveExtraWasteItemRequest { ItemType = "Toaster", WeightKg = 1m, Accepted = false, RejectionReason = "Not e-waste" }
            }
        };

        var result = await service.ReceiveAsync(request, Guid.NewGuid());

        Assert.Equal(2, result.Items.Count);
        Assert.Equal(1, await _db.InventoryItems.CountAsync());
    }
}