using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class ClassificationValidationServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private ClassificationValidationService _service = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();
        _service = new ClassificationValidationService(_db);
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); await _connection.DisposeAsync(); }

    private async Task<Guid> SeedSortingItemAsync(string itemType)
    {
        var location = new WarehouseLocation { Name = "Sorting Area" };
        _db.WarehouseLocations.Add(location);
        var item = new InventoryItem { OriginType = OriginType.ExtraWaste, ItemType = itemType, VerifiedWeightKg = 1m, CurrentLocationId = location.Id };
        item.MarkReceived(Guid.NewGuid());
        _db.InventoryItems.Add(item);
        await _db.SaveChangesAsync();
        item.TransitionTo(InventoryStatus.Sorting, Guid.NewGuid());
        await _db.SaveChangesAsync();
        return item.Id;
    }

    [Fact]
    public async Task ValidateAsync_HazardKeywordButNotClassifiedHazardous_FlagsForHumanReview()
    {
        var itemId = await SeedSortingItemAsync("Laptop Battery");

        var result = await _service.ValidateAsync(itemId,
            new ValidateClassificationRequest { ProposedCategory = ClassificationCategory.LocalRecyclable });

        Assert.True(result.Approved);
        Assert.True(result.RequiresHumanReview);
    }

    [Fact]
    public async Task ValidateAsync_LowConfidence_FlagsForHumanReview()
    {
        var itemId = await SeedSortingItemAsync("Plastic Casing");

        var result = await _service.ValidateAsync(itemId,
            new ValidateClassificationRequest { ProposedCategory = ClassificationCategory.LocalRecyclable, ConfidenceScore = 0.4m });

        Assert.True(result.RequiresHumanReview);
    }

    [Fact]
    public async Task ValidateAsync_ItemNotInSortingOrDismantling_RejectsOutright()
    {
        // 1. Seed the required location parent record
        var location = new WarehouseLocation { Name = "Receiving Area" };
        _db.WarehouseLocations.Add(location);
        await _db.SaveChangesAsync();
    
        // 2. Reference the seeded location's ID
        var item = new InventoryItem { 
            OriginType = OriginType.ExtraWaste, 
            ItemType = "Laptop", 
            VerifiedWeightKg = 1m, 
            CurrentLocationId = location.Id 
        };
        item.MarkReceived(Guid.NewGuid());
        _db.InventoryItems.Add(item);
        await _db.SaveChangesAsync();
    
        var result = await _service.ValidateAsync(item.Id,
            new ValidateClassificationRequest { ProposedCategory = ClassificationCategory.Reusable });
    
        Assert.False(result.Approved);
    }
}