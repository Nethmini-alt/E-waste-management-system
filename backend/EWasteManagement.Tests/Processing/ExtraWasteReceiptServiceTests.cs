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

    [Fact]
    public async Task ReceiveAsync_MixedAcceptedAndRejected_OnlyAcceptedCreateInventoryItems()
    {
        var locationId = await SeedLocationAsync();
        var service = CreateService();

        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = Guid.NewGuid(),
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
        var service = CreateService();
        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = Guid.NewGuid(),
            WarehouseLocationId = locationId,
            IdempotencyKey = "receipt-key-001",
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 3.2m, Accepted = true } }
        };

        var first = await service.ReceiveAsync(request, Guid.NewGuid());
        var second = await service.ReceiveAsync(request, Guid.NewGuid());

        Assert.Equal(first.ExtraWasteReceiptId, second.ExtraWasteReceiptId);
        Assert.Equal(1, await _db.ExtraWasteReceipts.CountAsync());
    }
}