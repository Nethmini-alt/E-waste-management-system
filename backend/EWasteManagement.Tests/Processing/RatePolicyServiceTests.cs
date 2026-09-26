using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Exceptions;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

/// <summary>
/// Rate rows are never edited — the only change to an existing row is switching it off — so the table
/// stays an exact history. Seeded active rates (HasData): Laptop 50, Mobile Phone 80, Battery 30,
/// General Household Electronics 40, GeneralCollection 20.
/// </summary>
public class RatePolicyServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private RatePolicyService _service = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();
        _service = new RatePolicyService(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private Task<Guid> ActiveIdAsync(string itemType)
        => _db.RatePolicies.Where(r => r.ItemType == itemType && r.IsActive).Select(r => r.Id).SingleAsync();

    [Fact]
    public async Task Create_NewType_AddsAnActiveRate()
    {
        var result = await _service.CreateAsync(new CreateRatePolicyRequest { ItemType = "  Printer ", RatePerKg = 35m });

        Assert.Equal("Printer", result.ItemType);
        Assert.True(result.IsActive);
        Assert.Equal(35m, (await _db.RatePolicies.SingleAsync(r => r.Id == result.Id)).RatePerKg);
    }

    [Theory]
    [InlineData("Laptop")]
    [InlineData("LAPTOP")]
    public async Task Create_TypeAlreadyActive_IgnoringCase_IsRejected(string itemType)
    {
        await Assert.ThrowsAsync<DuplicateActiveRatePolicyException>(() =>
            _service.CreateAsync(new CreateRatePolicyRequest { ItemType = itemType, RatePerKg = 10m }));

        Assert.Equal(1, await _db.RatePolicies.CountAsync(r => r.ItemType.ToLower() == "laptop"));
    }

    [Fact]
    public async Task Create_TypeThatExistedBefore_KeepsItsOriginalSpelling()
    {
        await _service.DeactivateAsync(await ActiveIdAsync("Battery"));

        var result = await _service.CreateAsync(new CreateRatePolicyRequest { ItemType = "battery", RatePerKg = 33m });

        Assert.Equal("Battery", result.ItemType);
    }

    [Fact]
    public async Task Revise_KeepsTheOldRateAsInactiveHistory_AndAddsTheNewActiveRate()
    {
        var oldId = await ActiveIdAsync("Laptop");

        var revised = await _service.ReviseAsync(oldId, new ReviseRatePolicyRequest { RatePerKg = 55m });

        _db.ChangeTracker.Clear();
        var rows = await _db.RatePolicies.Where(r => r.ItemType == "Laptop").ToListAsync();
        Assert.Equal(2, rows.Count);
        Assert.False(rows.Single(r => r.Id == oldId).IsActive);
        Assert.Equal(50m, rows.Single(r => r.Id == oldId).RatePerKg);
        Assert.True(rows.Single(r => r.Id == revised.Id).IsActive);
        Assert.Equal(55m, rows.Single(r => r.Id == revised.Id).RatePerKg);
    }

    [Fact]
    public async Task Revise_ThenPaymentLookup_UsesTheNewRate()
    {
        await _service.ReviseAsync(await ActiveIdAsync("Battery"), new ReviseRatePolicyRequest { RatePerKg = 31.5m });

        var rate = await new RatePolicyLookupService(_db).GetActiveRateAsync("battery");

        Assert.Equal(31.5m, rate!.RatePerKg);
    }

    [Fact]
    public async Task Revise_InactiveOrUnchangedRate_IsRejected()
    {
        var id = await ActiveIdAsync("Laptop");
        await Assert.ThrowsAsync<ArgumentException>(() => _service.ReviseAsync(id, new ReviseRatePolicyRequest { RatePerKg = 50m }));

        await _service.DeactivateAsync(id);
        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.ReviseAsync(id, new ReviseRatePolicyRequest { RatePerKg = 60m }));
    }

    [Fact]
    public async Task Deactivate_GeneralCollection_IsRefused_ButItCanBeRevised()
    {
        var id = await ActiveIdAsync("GeneralCollection");

        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.DeactivateAsync(id));
        var revised = await _service.ReviseAsync(id, new ReviseRatePolicyRequest { RatePerKg = 22m });

        Assert.True(revised.IsActive);
        Assert.Equal("GeneralCollection", revised.ItemType);
    }

    [Fact]
    public async Task Deactivate_ThenRestore_AddsANewActiveRowWithTheSameRate()
    {
        var id = await ActiveIdAsync("Mobile Phone");
        await _service.DeactivateAsync(id);
        Assert.Null(await new RatePolicyLookupService(_db).GetActiveRateAsync("Mobile Phone"));

        var restored = await _service.RestoreAsync(id);

        Assert.NotEqual(id, restored.Id);
        Assert.True(restored.IsActive);
        Assert.Equal(80m, restored.RatePerKg);
        _db.ChangeTracker.Clear();
        Assert.False((await _db.RatePolicies.SingleAsync(r => r.Id == id)).IsActive);
    }

    [Fact]
    public async Task Restore_WhenTheTypeAlreadyHasAnActiveRate_IsRejected()
    {
        var oldId = await ActiveIdAsync("Laptop");
        await _service.ReviseAsync(oldId, new ReviseRatePolicyRequest { RatePerKg = 55m }); // old row now inactive

        await Assert.ThrowsAsync<DuplicateActiveRatePolicyException>(() => _service.RestoreAsync(oldId));
    }

    [Fact]
    public async Task UnknownId_IsNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.DeactivateAsync(Guid.NewGuid()));
    }
}
