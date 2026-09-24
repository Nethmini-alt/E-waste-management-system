using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Features.Sales.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Sales;

/// <summary>
/// Locks in the two rules that protect the price list:
///
///  1. A price may only price an order while it is Approved AND its expiry date has not
///     passed (<see cref="MaterialPricingPolicy"/>). The sweeper merely tidies the stored
///     Status — correctness must not depend on it having run.
///  2. At most ONE Approved row per material type, enforced by the database through the
///     partial unique index IX_material_pricing_material_type_approved_unique, not just by
///     service-layer checks a concurrent approval could slip past.
/// </summary>
public class MaterialPricingServiceTests : IAsyncLifetime
{
    private static readonly DateOnly Today = MaterialPricingPolicy.Today;
    private static readonly DateOnly Future = Today.AddDays(30);
    private static readonly DateOnly Yesterday = Today.AddDays(-1);

    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private MaterialPricingService _service = null!;
    private Guid _userId;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();

        // material_pricing.created_by_user_id is a real FK — seed a staff user so the rows
        // below stay valid whichever way the provider treats foreign keys.
        var user = new User
        {
            UserId = Guid.NewGuid(),
            Email = "pricing.tests@example.com",
            PasswordHash = "not-a-real-hash",
            FullName = "Pricing Tester",
            Role = UserRole.Staff,
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        _userId = user.UserId;

        _service = new MaterialPricingService(_db);
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    // ---------- Rule 1: "live" means Approved and not yet expired ----------

    [Fact]
    public async Task LiveQuery_KeepsOnlyApprovedRowsInsideTheirExpiryWindow()
    {
        await AddApprovedAsync("Aluminium", 950m, Today.AddDays(-5), Future);   // live
        await AddApprovedAsync("Gold", 18500m, Today.AddDays(-5), null);        // live: "until replaced"
        await InsertApprovedDirectlyAsync("Copper", 1800m, Today.AddDays(-10), Yesterday);  // dead by date

        _db.ChangeTracker.Clear();
        var live = await _db.MaterialPricings
            .WhereLive(Today)
            .Select(p => p.MaterialType)
            .OrderBy(t => t)
            .ToListAsync();

        Assert.Equal(new[] { "Aluminium", "Gold" }, live);
    }

    [Fact]
    public async Task LiveQuery_TreatsTheExpiryDateItselfAsAlreadyExpired()
    {
        // Approved while it was live as "expires today"; on the day itself it is already
        // outside the window, so the boundary is deliberately inclusive of expiry.
        await InsertApprovedDirectlyAsync("Copper", 1800m, Today.AddDays(-5), Today);

        _db.ChangeTracker.Clear();

        Assert.Empty(await _db.MaterialPricings.WhereLive(Today).ToListAsync());
    }

    [Fact]
    public async Task CurrentForAsync_RefusesAnApprovedRowWhoseExpiryHasPassed()
    {
        await InsertApprovedDirectlyAsync("Copper", 1800m, Today.AddDays(-10), Yesterday);

        _db.ChangeTracker.Clear();

        // This is the lookup SalesOrderService / ExportOrderService / the agent endpoint use,
        // so a dead price can never reach an order line even before the sweeper has run.
        Assert.Null(await _db.MaterialPricings.CurrentForAsync("Copper", Today));
    }

    [Fact]
    public async Task ExpireStaleAsync_MarksPastExpiryApprovedRowsExpired_AndLeavesOtherRowsAlone()
    {
        var stale = await InsertApprovedDirectlyAsync("Copper", 1800m, Today.AddDays(-10), Yesterday);
        var live = await AddApprovedAsync("Aluminium", 950m, Today.AddDays(-5), Future);
        var openEnded = await AddApprovedAsync("Gold", 18500m, Today.AddDays(-5), null);
        var draft = await _service.CreateAsync(new CreateMaterialPricingRequest
        {
            MaterialType = "PCB",
            PricePerKg = 1250m,
            EffectiveDate = Today.AddDays(-2),
            ExpiryDate = Yesterday,
        }, _userId);

        var expired = await _service.ExpireStaleAsync();

        Assert.Equal(1, expired);   // only the stale Approved row — a Draft is never touched
        Assert.Equal(PricingStatus.Expired, (await ReloadAsync(stale.PricingId)).Status);
        Assert.Equal(PricingStatus.Approved, (await ReloadAsync(live.PricingId)).Status);
        Assert.Equal(PricingStatus.Approved, (await ReloadAsync(openEnded.PricingId)).Status);
        Assert.Equal(PricingStatus.Draft, (await ReloadAsync(draft.PricingId)).Status);
        Assert.NotNull((await ReloadAsync(stale.PricingId)).UpdatedAt);

        Assert.Equal(0, await _service.ExpireStaleAsync());   // idempotent
    }

    [Fact]
    public async Task ApprovingAPriceWhoseExpiryHasAlreadyPassed_IsRejected()
    {
        var draft = await _service.CreateAsync(new CreateMaterialPricingRequest
        {
            MaterialType = "Copper",
            PricePerKg = 1800m,
            EffectiveDate = Today.AddDays(-10),
            ExpiryDate = Yesterday,
        }, _userId);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.UpdateAsync(draft.PricingId, NewUpdate(draft, "Approved")));

        Assert.Contains("already passed", ex.Message);
        Assert.Equal(PricingStatus.Draft, (await ReloadAsync(draft.PricingId)).Status);
    }

    // ---------- Rule 2: one approved price per material type ----------

    [Fact]
    public async Task ApprovingASecondRowForTheSameMaterial_ExpiresTheFirst()
    {
        var first = await AddApprovedAsync("Copper", 1800m, Today.AddDays(-5), null);

        var second = await _service.CreateAsync(NewRequest("Copper", 1900m, Today), _userId);
        Assert.Equal("Draft", second.Status);   // the response DTO exposes status as a string

        var approved = await _service.UpdateAsync(second.PricingId, NewUpdate(second, "Approved"));

        Assert.Equal("Approved", approved.Status);
        Assert.True(approved.IsLive);

        var superseded = await ReloadAsync(first.PricingId);
        Assert.Equal(PricingStatus.Expired, superseded.Status);
        Assert.Equal(Today, superseded.ExpiryDate);   // stamped with the new price's effective date
        Assert.NotNull(superseded.UpdatedAt);
    }

    [Fact]
    public async Task RenamingAndApprovingInOneRequest_StillExpiresThePreviousApprovedRow()
    {
        // Regression: superseding used to consult the row's OLD material type, so renaming a
        // draft on to a name that already had an approved price left two approved rows behind.
        var existing = await AddApprovedAsync("Copper", 1800m, Today.AddDays(-5), null);
        var draft = await _service.CreateAsync(NewRequest("Copper Wire", 1850m, Today), _userId);

        var approved = await _service.UpdateAsync(draft.PricingId, new UpdateMaterialPricingRequest
        {
            MaterialType = "Copper",
            PricePerKg = 1850m,
            EffectiveDate = Today,
            ExpiryDate = null,
            Status = "Approved",
        });

        Assert.Equal("Copper", approved.MaterialType);
        Assert.Equal(PricingStatus.Expired, (await ReloadAsync(existing.PricingId)).Status);
        Assert.Equal(1, await _db.MaterialPricings
            .CountAsync(p => p.MaterialType == "Copper" && p.Status == PricingStatus.Approved));
    }

    [Fact]
    public async Task Database_RejectsASecondApprovedRowForTheSameMaterial()
    {
        await AddApprovedAsync("Copper", 1800m, Today, null);

        // Inserted behind the service's back — the way two concurrent approvals would land.
        // A different effective date keeps the (material, effective date) index out of the
        // picture, so only the partial "one approved per material" index can reject this.
        _db.MaterialPricings.Add(new MaterialPricing
        {
            MaterialType = "Copper",
            PricePerKg = 1999m,
            EffectiveDate = Today.AddDays(1),
            Status = PricingStatus.Approved,
            CreatedByUserId = _userId,
        });

        await Assert.ThrowsAsync<DbUpdateException>(() => _db.SaveChangesAsync());
    }

    [Fact]
    public async Task Database_StillAllowsManyDraftAndExpiredRowsPerMaterial()
    {
        _db.MaterialPricings.AddRange(
            NewRow("Copper", 100m, Today, PricingStatus.Draft),
            NewRow("Copper", 110m, Today.AddDays(1), PricingStatus.Draft),
            NewRow("Copper", 120m, Today.AddDays(2), PricingStatus.Expired),
            NewRow("Copper", 130m, Today.AddDays(3), PricingStatus.Approved));

        await _db.SaveChangesAsync();   // the filtered index leaves history alone

        Assert.Equal(4, await _db.MaterialPricings.CountAsync(p => p.MaterialType == "Copper"));
    }

    [Fact]
    public async Task UpdateAsync_TurnsAUniqueViolationIntoADomainError()
    {
        // Point a draft at an approved row's effective date: the (material, effective date)
        // index trips and the caller must get a readable message, not a raw DbUpdateException.
        var approvedRow = await AddApprovedAsync("Copper", 1800m, Today.AddDays(-5), null);
        var draft = await _service.CreateAsync(NewRequest("Copper", 1900m, Today.AddDays(2)), _userId);

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            _service.UpdateAsync(draft.PricingId, new UpdateMaterialPricingRequest
            {
                MaterialType = "Copper",
                PricePerKg = 1900m,
                EffectiveDate = approvedRow.EffectiveDate,
                Status = "Draft",
            }));

        Assert.Contains("already exists", ex.Message);
        Assert.Equal(PricingStatus.Approved, (await ReloadAsync(approvedRow.PricingId)).Status);
    }

    [Fact]
    public async Task ApprovingANewPrice_LeavesExactlyOneLivePriceForTheMaterial()
    {
        var old = await AddApprovedAsync("Copper", 1800m, Today.AddDays(-5), null);
        var next = await AddApprovedAsync("Copper", 2100m, Today, Future);

        _db.ChangeTracker.Clear();
        var livePrices = await _db.MaterialPricings.WhereLive(Today).ToListAsync();

        Assert.Single(livePrices);
        Assert.Equal(next.PricingId, livePrices[0].PricingId);
        Assert.Equal(2100m, livePrices[0].PricePerKg);
        Assert.Equal(PricingStatus.Expired, (await ReloadAsync(old.PricingId)).Status);
    }

    // ---------- Helpers ----------

    private static CreateMaterialPricingRequest NewRequest(
        string materialType, decimal price, DateOnly effective)
        => new() { MaterialType = materialType, PricePerKg = price, EffectiveDate = effective };

    private static UpdateMaterialPricingRequest NewUpdate(
        MaterialPricingResponse row, string status, DateOnly? expiry = null)
        => new()
        {
            MaterialType = row.MaterialType,
            PricePerKg = row.PricePerKg,
            EffectiveDate = row.EffectiveDate,
            ExpiryDate = expiry ?? row.ExpiryDate,
            Status = status,
        };

    private MaterialPricing NewRow(
        string materialType, decimal price, DateOnly effective, PricingStatus status)
        => new()
        {
            MaterialType = materialType,
            PricePerKg = price,
            EffectiveDate = effective,
            Status = status,
            CreatedByUserId = _userId,
        };

    /// <summary>Creates and approves a price through the service, the way staff do.</summary>
    private async Task<MaterialPricingResponse> AddApprovedAsync(
        string materialType, decimal price, DateOnly effective, DateOnly? expiry)
    {
        var created = await _service.CreateAsync(NewRequest(materialType, price, effective), _userId);
        return await _service.UpdateAsync(created.PricingId, NewUpdate(created, "Approved", expiry));
    }

    /// <summary>
    /// Inserts an Approved row directly — a price that was legitimately approved while it was
    /// still live and whose expiry date has since gone by. This cannot go through the service,
    /// which (correctly) refuses to newly approve an already-expired price.
    /// </summary>
    private async Task<MaterialPricing> InsertApprovedDirectlyAsync(
        string materialType, decimal price, DateOnly effective, DateOnly? expiry)
    {
        var row = NewRow(materialType, price, effective, PricingStatus.Approved);
        row.ExpiryDate = expiry;
        _db.MaterialPricings.Add(row);
        await _db.SaveChangesAsync();
        _db.ChangeTracker.Clear();
        return row;
    }

    private async Task<MaterialPricing> ReloadAsync(Guid pricingId)
    {
        _db.ChangeTracker.Clear();
        return await _db.MaterialPricings.AsNoTracking().FirstAsync(p => p.PricingId == pricingId);
    }
}
