using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
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

    // ---------------------------------------------------------------- dismantle: components and materials

    private async Task AddMaterialPriceAsync(params string[] materialTypes)
    {
        var user = new User
        {
            Email = $"{Guid.NewGuid()}@test.com", PasswordHash = "x", FullName = "Pricer",
            Role = UserRole.Staff, StaffType = StaffType.Management
        };
        _db.Users.Add(user);
        var day = 1;
        foreach (var type in materialTypes)
        {
            _db.MaterialPricings.Add(new MaterialPricing
            {
                MaterialType = type, PricePerKg = 100m, Status = PricingStatus.Approved, CreatedByUserId = user.UserId,
                EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-day++)
            });
        }
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task AddDismantleLogAsync_Component_IsRecoveredComponentNotReceived()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Battery removed",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0.4m } }
        }, Guid.NewGuid());

        var child = await _db.InventoryItems.SingleAsync(i => i.Id == result.ChildInventoryItemIds[0]);
        Assert.Equal(InventoryStatus.Recovered, child.Status);
        Assert.Equal(ItemKind.Component, child.Kind);
    }

    [Fact]
    public async Task AddDismantleLogAsync_Material_IsReadyForSaleWithACategory()
    {
        await AddMaterialPriceAsync("Copper");
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Cables stripped",
            Materials = { new RecoveredMaterialRequest { MaterialType = " copper ", WeightKg = 0.3m } }
        }, Guid.NewGuid());

        var material = await _db.InventoryItems.SingleAsync(i => i.Id == result.MaterialInventoryItemIds[0]);
        Assert.Equal(InventoryStatus.ReadyForSale, material.Status);
        Assert.Equal(ItemKind.Material, material.Kind);
        Assert.Equal("Copper", material.ItemType);
        Assert.Equal(itemId, material.ParentInventoryItemId);
        var record = await _db.ClassificationRecords.SingleAsync(c => c.InventoryItemId == material.Id);
        Assert.Equal(ClassificationCategory.LocalRecyclable, record.Category);
    }

    [Fact]
    public async Task AddDismantleLogAsync_HazardousMaterial_IsHeldNotSold()
    {
        await AddMaterialPriceAsync("PCB", "Lithium Battery Cells");
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Board and cells removed",
            Materials =
            {
                new RecoveredMaterialRequest { MaterialType = "PCB", WeightKg = 0.2m, Hazardous = true },
                // Not ticked, but the name is a known hazard.
                new RecoveredMaterialRequest { MaterialType = "Lithium Battery Cells", WeightKg = 0.3m }
            }
        }, Guid.NewGuid());

        var statuses = await _db.InventoryItems
            .Where(i => result.MaterialInventoryItemIds.Contains(i.Id))
            .Select(i => i.Status)
            .ToListAsync();
        Assert.All(statuses, s => Assert.Equal(InventoryStatus.OnHold, s));
    }

    [Fact]
    public async Task AddDismantleLogAsync_MaterialSalesDoesNotPrice_IsRejected()
    {
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        await Assert.ThrowsAsync<ArgumentException>(() => _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Mystery metal",
            Materials = { new RecoveredMaterialRequest { MaterialType = "Unobtainium", WeightKg = 0.1m } }
        }, Guid.NewGuid()));

        Assert.Equal(1, await _db.InventoryItems.CountAsync());
    }

    [Fact]
    public async Task AddDismantleLogAsync_MaterialsCountTowardsTheParentsWeight()
    {
        await AddMaterialPriceAsync("Aluminium");
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);

        var result = await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Frame and battery removed",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0.4m } },
            Materials = { new RecoveredMaterialRequest { MaterialType = "Aluminium", WeightKg = 1m } }
        }, Guid.NewGuid());
        Assert.Equal(1.6m, result.UpdatedWeightKg);

        await Assert.ThrowsAsync<ArgumentException>(() => _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Too much",
            Materials = { new RecoveredMaterialRequest { MaterialType = "Aluminium", WeightKg = 2m } }
        }, Guid.NewGuid()));
    }

    [Fact]
    public async Task RecoveredComponent_GoesToSorting_ButCannotSkipAhead()
    {
        var parentId = await SeedItemInStatusAsync(InventoryStatus.Sorting);
        var result = await _service.AddDismantleLogAsync(parentId, new AddDismantleLogRequest
        {
            Description = "Battery removed",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0.4m } }
        }, Guid.NewGuid());
        var childId = result.ChildInventoryItemIds[0];

        await Assert.ThrowsAsync<InvalidStatusTransitionException>(() =>
            _service.TransitionStatusAsync(childId, InventoryStatus.ReadyForSale, Guid.NewGuid(), null, null));

        var moved = await _service.TransitionStatusAsync(childId, InventoryStatus.Sorting, Guid.NewGuid(), null, null);
        Assert.Equal("Sorting", moved.Status);
    }

    [Fact]
    public async Task ListAsync_FiltersByKind()
    {
        await AddMaterialPriceAsync("Copper");
        var itemId = await SeedItemInStatusAsync(InventoryStatus.Sorting);
        await _service.AddDismantleLogAsync(itemId, new AddDismantleLogRequest
        {
            Description = "Split",
            ChildItems = { new CreateChildInventoryItemRequest { ItemType = "Battery", WeightKg = 0.4m } },
            Materials = { new RecoveredMaterialRequest { MaterialType = "Copper", WeightKg = 0.2m } }
        }, Guid.NewGuid());

        var materials = await _service.ListAsync(new InventoryListQuery { Kind = ItemKind.Material });
        var units = await _service.ListAsync(new InventoryListQuery { Kind = ItemKind.Unit });

        Assert.Equal("Copper", Assert.Single(materials.Items).ItemType);
        Assert.Equal("Material", materials.Items[0].Kind);
        Assert.Equal(itemId, Assert.Single(units.Items).Id);
    }

    [Fact]
    public async Task RecoveredMaterialSummary_GroupsByMaterialWithTotalsAndLocations()
    {
        await AddMaterialPriceAsync("Aluminium", "Copper");
        var first = await SeedItemInStatusAsync(InventoryStatus.Sorting);
        var second = await SeedItemInStatusAsync(InventoryStatus.Sorting);
        await _service.AddDismantleLogAsync(first, new AddDismantleLogRequest
        {
            Description = "Frame",
            Materials = { new RecoveredMaterialRequest { MaterialType = "Aluminium", WeightKg = 1m } }
        }, Guid.NewGuid());
        await _service.AddDismantleLogAsync(second, new AddDismantleLogRequest
        {
            Description = "Frame and cables",
            Materials =
            {
                new RecoveredMaterialRequest { MaterialType = "aluminium", WeightKg = 0.4m },
                new RecoveredMaterialRequest { MaterialType = "Copper", WeightKg = 0.2m }
            }
        }, Guid.NewGuid());

        var groups = await new RecoveredMaterialSummaryService(_db).GetGroupsAsync();

        var aluminium = Assert.Single(groups, g => g.MaterialType == "Aluminium");
        Assert.Equal(1.4m, aluminium.TotalWeightKg);
        Assert.Equal(1.4m, aluminium.AvailableWeightKg);
        Assert.Equal(2, aluminium.ItemCount);
        Assert.All(aluminium.Items, i => Assert.Equal("Sorting Area", i.LocationName));
        Assert.Equal("Laptop", aluminium.Items[0].ParentItemType);
        Assert.Equal(0.2m, Assert.Single(groups, g => g.MaterialType == "Copper").TotalWeightKg);
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