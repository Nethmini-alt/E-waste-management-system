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
        _service = new InventoryProcessingService(_db, new ItemTypeCatalogService(_db));

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

    // ---------------------------------------------------------------- dismantle: weight is conserved
    // The seeded item weighs 3 kg.

    [Fact]
    public async Task AddDismantleLogAsync_NoRemainingWeight_TakesTheComponentsOffTheParent()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Battery removed",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0.4m } }
        }, Guid.NewGuid());

        Assert.Equal(2.6m, result.UpdatedWeightKg);
        Assert.Equal(0m, result.LossKg);
        _db.ChangeTracker.Clear();
        Assert.Equal(2.6m, (await _db.InventoryItems.SingleAsync(i => i.Id == itemId)).VerifiedWeightKg);
    }

    [Fact]
    public async Task AddDismantleLogAsync_WithRemainingWeight_RecordsTheGapAsLoss()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Battery removed",
            RemainingWeightKg = 2.1m,
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0.4m } }
        }, Guid.NewGuid());

        Assert.Equal(2.1m, result.UpdatedWeightKg);
        Assert.Equal(0.5m, result.LossKg);
        var log = await _db.ProcessingLogs.SingleAsync(l => l.InventoryItemId == itemId && l.Action == "DismantleStep");
        Assert.Contains("loss 0.5 kg", log.Notes);
    }

    [Fact]
    public async Task AddDismantleLogAsync_ComponentsHeavierThanTheParent_IsRejectedAndChangesNothing()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        await Assert.ThrowsAsync<ArgumentException>(() => _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Too much",
            ChildItems =
            {
                new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 2m },
                new CreateChildInventoryItemRequest { ItemType = "Laptop", WeightKg = 1.5m }
            }
        }, Guid.NewGuid()));

        _db.ChangeTracker.Clear();
        var item = await _db.InventoryItems.SingleAsync(i => i.Id == itemId);
        Assert.Equal(3m, item.VerifiedWeightKg);
        Assert.Equal(InventoryStatus.Sorting, item.Status);
        Assert.Equal(1, await _db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task AddDismantleLogAsync_ComponentsPlusRemainingOverTheParent_IsRejected()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        await Assert.ThrowsAsync<ArgumentException>(() => _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Double counted",
            RemainingWeightKg = 3m,
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0.4m } }
        }, Guid.NewGuid()));

        Assert.Equal(1, await _db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task AddDismantleLogAsync_UnknownComponentType_IsRejected_KnownTypeUsesTheListsSpelling()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        await Assert.ThrowsAsync<ArgumentException>(() => _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Mystery part",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Unicorn Parts", WeightKg = 0.1m } }
        }, Guid.NewGuid()));
        Assert.Equal(1, await _db.InventoryItems.CountAsync());

        var result = await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Battery removed",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "  battery ", WeightKg = 0.4m } }
        }, Guid.NewGuid());

        var child = await _db.InventoryItems.SingleAsync(i => i.Id == result.ChildInventoryItemIds[0]);
        Assert.Equal("Battery", child.ItemType);
    }

    // ---------------------------------------------------------------- category decides the outcome

    private async Task<Guid> SeedClassifiedItemAsync(ClassificationCategory category)
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);
        await _service.ClassifyAsync(itemId, new ClassifyInventoryItemRequest { Category = category }, Guid.NewGuid());
        return itemId;
    }

    [Theory]
    [InlineData(ClassificationCategory.Reusable, InventoryStatus.ReadyForSale)]
    [InlineData(ClassificationCategory.LocalRecyclable, InventoryStatus.ReadyForSale)]
    [InlineData(ClassificationCategory.ExportOnly, InventoryStatus.ExportOnly)]
    [InlineData(ClassificationCategory.Reusable, InventoryStatus.OnHold)]
    [InlineData(ClassificationCategory.ExportOnly, InventoryStatus.OnHold)]
    public async Task TransitionStatusAsync_OutcomeMatchingTheCategory_IsAllowed(ClassificationCategory category, InventoryStatus outcome)
    {
        var itemId = await SeedClassifiedItemAsync(category);

        var result = await _service.TransitionStatusAsync(itemId, outcome, Guid.NewGuid(), null, null);

        Assert.Equal(outcome.ToString(), result.Status);
    }

    [Theory]
    [InlineData(ClassificationCategory.Reusable, InventoryStatus.ExportOnly)]
    [InlineData(ClassificationCategory.LocalRecyclable, InventoryStatus.ExportOnly)]
    [InlineData(ClassificationCategory.ExportOnly, InventoryStatus.ReadyForSale)]
    public async Task TransitionStatusAsync_OutcomeNotMatchingTheCategory_IsRejected(ClassificationCategory category, InventoryStatus outcome)
    {
        var itemId = await SeedClassifiedItemAsync(category);

        await Assert.ThrowsAsync<ArgumentException>(() =>
            _service.TransitionStatusAsync(itemId, outcome, Guid.NewGuid(), null, null));

        _db.ChangeTracker.Clear();
        Assert.Equal(InventoryStatus.Classified, (await _db.InventoryItems.SingleAsync(i => i.Id == itemId)).Status);
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