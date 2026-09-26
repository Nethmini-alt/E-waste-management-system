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

    [Fact]
    public async Task TransitionStatusAsync_SortingToClassified_IsRejectedBecauseItMustGoThroughClassify()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.TransitionStatusAsync(itemId, InventoryStatus.Classified, Guid.NewGuid(), null, null));

        _db.ChangeTracker.Clear();
        Assert.Equal(InventoryStatus.Sorting, (await _db.InventoryItems.SingleAsync(i => i.Id == itemId)).Status);
        Assert.Equal(0, await _db.ClassificationRecords.CountAsync());
    }

    [Fact]
    public async Task TransitionStatusAsync_DismantlingToClassified_IsRejectedBecauseItMustGoThroughClassify()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);
        await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest { Description = "Casing removed" }, Guid.NewGuid());

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.TransitionStatusAsync(itemId, InventoryStatus.Classified, Guid.NewGuid(), null, null));
    }

    private async Task<Guid> SeedSecondLocationAsync()
    {
        var location = new WarehouseLocation { Name = "Ready-for-Sale Storage" };
        _db.WarehouseLocations.Add(location);
        await _db.SaveChangesAsync();
        return location.Id;
    }

    [Fact]
    public async Task MoveLocationAsync_ChangesLocationAndLogsFromAndToNames()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);
        var targetId = await SeedSecondLocationAsync();
        var staffId = Guid.NewGuid();

        await _service.MoveLocationAsync(itemId, targetId, staffId);

        var item = await _db.InventoryItems.SingleAsync(i => i.Id == itemId);
        Assert.Equal(targetId, item.CurrentLocationId);
        var log = await _db.ProcessingLogs.SingleAsync(l => l.InventoryItemId == itemId && l.Action == "LocationMoved");
        Assert.Equal(staffId, log.PerformedByStaffId);
        Assert.Contains("Sorting Area", log.Notes);
        Assert.Contains("Ready-for-Sale Storage", log.Notes);
    }

    [Fact]
    public async Task MoveLocationAsync_SameLocation_ChangesNothingAndLogsNothing()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        await _service.MoveLocationAsync(itemId, _locationId, Guid.NewGuid());

        Assert.Equal(0, await _db.ProcessingLogs.CountAsync(l => l.Action == "LocationMoved"));
    }

    [Fact]
    public async Task MoveLocationAsync_UnknownLocation_Throws()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        await Assert.ThrowsAsync<KeyNotFoundException>(() =>
            _service.MoveLocationAsync(itemId, Guid.NewGuid(), Guid.NewGuid()));
    }

    [Fact]
    public async Task TransitionStatusAsync_WithNewLocation_AlsoLogsTheLocationChange()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Received);
        var targetId = await SeedSecondLocationAsync();

        var result = await _service.TransitionStatusAsync(itemId, InventoryStatus.Sorting, Guid.NewGuid(), null, targetId);

        Assert.Equal(targetId, result.CurrentLocationId);
        Assert.Equal(1, await _db.ProcessingLogs.CountAsync(l => l.InventoryItemId == itemId && l.Action == "LocationMoved"));
    }

    [Fact]
    public async Task MoveLocationAsync_AfterReadyForSale_IsStillAllowedAndLogged()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);
        var staffId = Guid.NewGuid();
        await _service.ClassifyAsync(itemId,
            new ClassifyInventoryItemRequest { Category = ClassificationCategory.Reusable }, staffId);
        await _service.TransitionStatusAsync(itemId, InventoryStatus.ReadyForSale, staffId, null, null);
        var targetId = await SeedSecondLocationAsync();

        await _service.MoveLocationAsync(itemId, targetId, staffId);

        Assert.Equal(targetId, (await _db.InventoryItems.SingleAsync(i => i.Id == itemId)).CurrentLocationId);
        Assert.Equal(1, await _db.ProcessingLogs.CountAsync(l => l.InventoryItemId == itemId && l.Action == "LocationMoved"));
    }
}