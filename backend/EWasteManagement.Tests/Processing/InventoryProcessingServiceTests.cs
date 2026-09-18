using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Shared.Common;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class InventoryProcessingServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private InventoryProcessingService _service = null!;
    private Guid _locationId;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        // Real dispatcher swapped in only where we need to prove logs are written automatically.
        await _db.Database.EnsureCreatedAsync();
        _service = new InventoryProcessingService(_db);

        var location = new WarehouseLocation { Name = "Sorting Area" };
        _db.WarehouseLocations.Add(location);
        await _db.SaveChangesAsync();
        _locationId = location.Id;
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); await _connection.DisposeAsync(); }

    private async Task<Guid> SeedItemInStatusAsync(InventoryStatus status)
    {
        var realDb = new ApplicationDbContext(
            new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options,
            new DirectDomainEventDispatcher(_db));

        var item = new InventoryItem { OriginType = OriginType.ExtraWaste, ItemType = "Laptop", VerifiedWeightKg = 3m, CurrentLocationId = _locationId };
        item.MarkReceived(Guid.NewGuid());
        realDb.InventoryItems.Add(item);
        await realDb.SaveChangesAsync();

        if (status == InventoryStatus.Sorting)
            item.TransitionTo(InventoryStatus.Sorting, Guid.NewGuid());
        if (status == InventoryStatus.Sorting)
            await realDb.SaveChangesAsync();

        return item.Id;
    }

    [Fact]
    public async Task ClassifyAsync_HazardousCategory_ForcesOnHoldInSameCall()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.ClassifyAsync(itemId,
            new ClassifyInventoryItemRequest { Category = ClassificationCategory.Hazardous, SubCategory = "Battery" },
            Guid.NewGuid());

        Assert.Equal("OnHold", result.Status);
        Assert.Equal(1, await _db.ClassificationRecords.CountAsync());
    }

    [Fact]
    public async Task ClassifyAsync_NonHazardous_MovesToClassifiedOnly()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.ClassifyAsync(itemId,
            new ClassifyInventoryItemRequest { Category = ClassificationCategory.LocalRecyclable, SubCategory = "Copper" },
            Guid.NewGuid());

        Assert.Equal("Classified", result.Status);
    }

    [Fact]
    public async Task AddDismantleLogAsync_WithChildItems_CreatesChildrenLinkedToParent()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.AddDismantleLogAsync(itemId,
            new AddDismantleLogRequest
            {
                Description = "Battery and motherboard removed",
                RemainingWeightKg = 2.1m,
                ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0.4m } }
            }, Guid.NewGuid());

        Assert.Single(result.ChildInventoryItemIds);
        var child = await _db.InventoryItems.SingleAsync(i => i.Id == result.ChildInventoryItemIds[0]);
        Assert.Equal(itemId, child.ParentInventoryItemId);
    }

    [Fact]
    public async Task TransitionStatusAsync_IllegalJump_Throws()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Received);

        await Assert.ThrowsAsync<InvalidStatusTransitionException>(() =>
            _service.TransitionStatusAsync(itemId, InventoryStatus.Classified, Guid.NewGuid(), null, null));
    }
}