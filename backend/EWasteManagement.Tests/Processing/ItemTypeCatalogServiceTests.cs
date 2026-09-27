using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

/// <summary>
/// The item-type list = active rate-policy types + every Material Pricing material type, one spelling
/// each (rate policy wins), never the reserved "GeneralCollection" payment key.
/// The seeded rate policies (Laptop, Mobile Phone, Battery, General Household Electronics,
/// GeneralCollection) are present because EnsureCreated applies HasData.
/// </summary>
public class ItemTypeCatalogServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private ItemTypeCatalogService _service = null!;
    private Guid _userId;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();

        // material_pricing.created_by_user_id is a real FK.
        var user = new User { Email = "catalog.tests@example.com", PasswordHash = "x", FullName = "Catalog Tester", Role = UserRole.Staff };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        _userId = user.UserId;

        _service = new ItemTypeCatalogService(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task AddPriceAsync(string materialType, PricingStatus status = PricingStatus.Approved)
    {
        _db.MaterialPricings.Add(new MaterialPricing
        {
            MaterialType = materialType, PricePerKg = 100m, Status = status, CreatedByUserId = _userId,
            EffectiveDate = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-_db.MaterialPricings.Local.Count - 1)
        });
        await _db.SaveChangesAsync();
    }

    [Fact]
    public async Task GetAllowedTypes_CombinesActiveRatesAndPricedMaterials_WithoutGeneralCollection()
    {
        await AddPriceAsync("Copper");
        await AddPriceAsync("PCB", PricingStatus.Expired); // any status counts

        var types = await _service.GetAllowedTypesAsync();

        Assert.Contains("Laptop", types);
        Assert.Contains("Battery", types);
        Assert.Contains("Copper", types);
        Assert.Contains("PCB", types);
        Assert.DoesNotContain("GeneralCollection", types);
        Assert.Equal(types.OrderBy(t => t, StringComparer.OrdinalIgnoreCase), types);
    }

    [Fact]
    public async Task GetAllowedTypes_DeduplicatesIgnoringCase_RatePolicySpellingWins()
    {
        await AddPriceAsync("BATTERY");

        var types = await _service.GetAllowedTypesAsync();

        Assert.Single(types, t => t.Equals("battery", StringComparison.OrdinalIgnoreCase));
        Assert.Contains("Battery", types);
    }

    [Fact]
    public async Task GetAllowedTypes_ExcludesInactiveRatePolicies()
    {
        var laptop = await _db.RatePolicies.SingleAsync(r => r.ItemType == "Laptop");
        laptop.IsActive = false;
        await _db.SaveChangesAsync();

        Assert.DoesNotContain("Laptop", await _service.GetAllowedTypesAsync());
    }

    [Theory]
    [InlineData("laptop", "Laptop")]
    [InlineData("  Mobile PHONE ", "Mobile Phone")]
    [InlineData("Unicorn Parts", null)]
    [InlineData("generalcollection", null)]
    [InlineData("", null)]
    [InlineData(null, null)]
    public async Task Resolve_ReturnsTheListsSpellingOrNull(string? input, string? expected)
    {
        Assert.Equal(expected, await _service.ResolveAsync(input));
    }
}
