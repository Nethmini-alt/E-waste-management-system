using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class InventoryQueryTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private InventoryProcessingService _inventory = null!;
    private CollectorPaymentService _payments = null!;
    private Guid _receivingBayId;
    private Guid _sortingAreaId;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();

        _inventory = new InventoryProcessingService(_db);
        _payments = new CollectorPaymentService(_db, Array.Empty<IPaymentCalculator>());

        var receiving = new WarehouseLocation { Name = "Receiving Bay" };
        var sorting = new WarehouseLocation { Name = "Sorting Area" };
        _db.WarehouseLocations.AddRange(receiving, sorting);
        await _db.SaveChangesAsync();
        _receivingBayId = receiving.Id;
        _sortingAreaId = sorting.Id;
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); await _connection.DisposeAsync(); }

    private async Task<InventoryItem> SeedItemAsync(
        string itemType, decimal weightKg = 1m, OriginType origin = OriginType.ExtraWaste,
        Guid? locationId = null, Guid? parentId = null, DateTime? createdAt = null)
    {
        var item = new InventoryItem
        {
            OriginType = origin, ItemType = itemType, VerifiedWeightKg = weightKg,
            CurrentLocationId = locationId ?? _receivingBayId, ParentInventoryItemId = parentId,
            CreatedAt = createdAt ?? DateTime.UtcNow
        };
        _db.InventoryItems.Add(item);
        await _db.SaveChangesAsync();
        return item;
    }

    [Fact]
    public async Task ListAsync_DefaultQuery_ReturnsNewestFirstWithPagingTotals()
    {
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < 5; i++)
            await SeedItemAsync($"Laptop {i}", createdAt: start.AddDays(i));

        var page2 = await _inventory.ListAsync(new InventoryListQuery { Page = 2, PageSize = 2 });

        Assert.Equal(5, page2.TotalCount);
        Assert.Equal(3, page2.TotalPages);
        Assert.Equal(2, page2.Page);
        Assert.Equal(new[] { "Laptop 2", "Laptop 1" }, page2.Items.Select(i => i.ItemType));
    }

    [Fact]
    public async Task ListAsync_Search_IsCaseInsensitiveAndMatchesPartOfTheName()
    {
        await SeedItemAsync("Laptop");
        await SeedItemAsync("Mobile Phone");

        var result = await _inventory.ListAsync(new InventoryListQuery { Search = "LAPT" });

        Assert.Equal("Laptop", Assert.Single(result.Items).ItemType);
    }

    [Fact]
    public async Task ListAsync_FiltersByOriginLocationAndParent()
    {
        var parent = await SeedItemAsync("Laptop", origin: OriginType.JobCollection);
        await SeedItemAsync("Battery", parentId: parent.Id, locationId: _sortingAreaId);
        await SeedItemAsync("Phone");

        Assert.Single((await _inventory.ListAsync(new InventoryListQuery { OriginType = OriginType.JobCollection })).Items);
        Assert.Single((await _inventory.ListAsync(new InventoryListQuery { LocationId = _sortingAreaId })).Items);
        var children = await _inventory.ListAsync(new InventoryListQuery { ParentId = parent.Id });
        Assert.Equal("Battery", Assert.Single(children.Items).ItemType);
    }

    [Fact]
    public async Task ListAsync_FilterByCategory_ReturnsOnlyItemsClassifiedThatWay()
    {
        var classified = await SeedItemAsync("Laptop");
        await SeedItemAsync("Unclassified Phone");
        _db.ClassificationRecords.Add(new ClassificationRecord
        {
            InventoryItemId = classified.Id, Category = ClassificationCategory.LocalRecyclable, Source = ClassificationSource.Manual
        });
        await _db.SaveChangesAsync();

        var recyclable = await _inventory.ListAsync(new InventoryListQuery { Category = ClassificationCategory.LocalRecyclable });
        var reusable = await _inventory.ListAsync(new InventoryListQuery { Category = ClassificationCategory.Reusable });
        var all = await _inventory.ListAsync(new InventoryListQuery());

        var match = Assert.Single(recyclable.Items);
        Assert.Equal("LocalRecyclable", match.Category);
        Assert.Empty(reusable.Items);
        Assert.Null(all.Items.Single(i => i.ItemType == "Unclassified Phone").Category);
    }

    [Fact]
    public async Task ListAsync_SortByItemTypeAscending_OrdersAlphabetically()
    {
        await SeedItemAsync("Mobile Phone");
        await SeedItemAsync("Battery");
        await SeedItemAsync("Laptop");

        var result = await _inventory.ListAsync(new InventoryListQuery { SortBy = InventorySortField.ItemType, Descending = false });

        Assert.Equal(new[] { "Battery", "Laptop", "Mobile Phone" }, result.Items.Select(i => i.ItemType));
    }

    [Fact]
    public async Task ListAsync_IncludesLocationNameAndStatusText()
    {
        await SeedItemAsync("Laptop");

        var item = Assert.Single((await _inventory.ListAsync(new InventoryListQuery())).Items);

        Assert.Equal("Receiving Bay", item.CurrentLocationName);
        Assert.Equal("Received", item.Status);
        Assert.Equal("ExtraWaste", item.OriginType);
    }

    [Fact]
    public async Task GetByIdAsync_ReturnsClassificationChildrenAndLocationName()
    {
        var parent = await SeedItemAsync("Laptop");
        await SeedItemAsync("Battery", 0.4m, parentId: parent.Id);
        _db.ClassificationRecords.Add(new ClassificationRecord
        {
            InventoryItemId = parent.Id, Category = ClassificationCategory.Hazardous, SubCategory = "Lithium",
            Source = ClassificationSource.Ai, ConfidenceScore = 0.93m, IsFinal = true
        });
        await _db.SaveChangesAsync();

        var detail = await _inventory.GetByIdAsync(parent.Id);

        Assert.Equal("Receiving Bay", detail.CurrentLocationName);
        Assert.Equal("Hazardous", detail.Classification!.Category);
        Assert.Equal("Lithium", detail.Classification.SubCategory);
        Assert.Equal(0.93m, detail.Classification.ConfidenceScore);
        Assert.Equal("Battery", Assert.Single(detail.Children).ItemType);
    }

    [Fact]
    public async Task GetByIdAsync_OlderItemWithoutReceiptId_FallsBackToTheReceiptLine()
    {
        var item = await SeedItemAsync("Laptop");
        var receipt = new ExtraWasteReceipt { CollectorId = Guid.NewGuid(), ReceivedByStaffId = Guid.NewGuid() };
        receipt.Items.Add(new ExtraWasteReceiptItem { ItemType = "Laptop", WeightKg = 1m, Accepted = true, InventoryItemId = item.Id });
        _db.ExtraWasteReceipts.Add(receipt);
        await _db.SaveChangesAsync();

        var detail = await _inventory.GetByIdAsync(item.Id);

        Assert.Equal(receipt.Id, detail.ExtraWasteReceiptId);
        Assert.Null(detail.Classification);
        Assert.Empty(detail.Children);
    }

    [Fact]
    public async Task GetByIdAsync_UnknownId_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _inventory.GetByIdAsync(Guid.NewGuid()));
    }

    private async Task SeedPaymentAsync(decimal amount, PaymentStatus status, Guid collectorId, DateTime createdAt,
        PaymentSourceType sourceType = PaymentSourceType.ExtraWaste)
    {
        _db.CollectorPayments.Add(new CollectorPayment
        {
            SourceType = sourceType, SourceId = Guid.NewGuid(), CollectorId = collectorId,
            Amount = amount, Status = status, CreatedAt = createdAt,
            PaidAt = status == PaymentStatus.Paid ? DateTime.UtcNow : null
        });
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetPendingAsync_ReturnsOnlyPendingOldestFirstWithTotalAmount()
    {
        var collector = Guid.NewGuid();
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        await SeedPaymentAsync(60.50m, PaymentStatus.Pending, collector, start.AddDays(2));
        await SeedPaymentAsync(100m, PaymentStatus.Pending, collector, start.AddDays(1));
        await SeedPaymentAsync(999m, PaymentStatus.Paid, collector, start);

        var result = await _payments.GetPendingAsync(new PendingPaymentsQuery());

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(160.50m, result.TotalPendingAmount);
        Assert.Equal(new[] { 100m, 60.50m }, result.Items.Select(p => p.Amount));
        Assert.All(result.Items, p => Assert.Equal("Pending", p.Status));
    }

    [Fact]
    public async Task GetPendingAsync_FiltersByCollectorAndSourceTypeAndPages()
    {
        var collectorA = Guid.NewGuid();
        var collectorB = Guid.NewGuid();
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        await SeedPaymentAsync(10m, PaymentStatus.Pending, collectorA, start, PaymentSourceType.Job);
        await SeedPaymentAsync(20m, PaymentStatus.Pending, collectorA, start.AddDays(1));
        await SeedPaymentAsync(30m, PaymentStatus.Pending, collectorB, start.AddDays(2));

        var forA = await _payments.GetPendingAsync(new PendingPaymentsQuery { CollectorId = collectorA });
        var jobsOnly = await _payments.GetPendingAsync(new PendingPaymentsQuery { SourceType = PaymentSourceType.Job });
        var paged = await _payments.GetPendingAsync(new PendingPaymentsQuery { Page = 2, PageSize = 2 });

        Assert.Equal(2, forA.TotalCount);
        Assert.Equal(30m, forA.TotalPendingAmount);
        Assert.Equal(10m, Assert.Single(jobsOnly.Items).Amount);
        Assert.Equal(3, paged.TotalCount);
        Assert.Equal(2, paged.TotalPages);
        Assert.Equal(30m, Assert.Single(paged.Items).Amount);
    }

    [Fact]
    public async Task GetPendingAsync_NothingPending_ReturnsEmptyPageWithZeroTotal()
    {
        var result = await _payments.GetPendingAsync(new PendingPaymentsQuery());

        Assert.Empty(result.Items);
        Assert.Equal(0, result.TotalCount);
        Assert.Equal(0m, result.TotalPendingAmount);
    }
}
