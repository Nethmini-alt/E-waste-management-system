using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

/// <summary>
/// Rejected lines contribute Rs. 0 and stay visible; GeneralCollection is reserved; receipt history/detail.
/// </summary>
public class ExtraWasteReceiptRulesTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private ExtraWasteReceiptService _service = null!;
    private CollectorPaymentService _payments = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();

        var rates = new RatePolicyLookupService(_db);
        var calculators = new IPaymentCalculator[] { new JobPaymentCalculator(rates), new ExtraWastePaymentCalculator(rates) };
        _payments = new CollectorPaymentService(_db, calculators);
        _service = new ExtraWasteReceiptService(_db, _payments);
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); await _connection.DisposeAsync(); }

    private async Task<Guid> LocationAsync() => (await _db.WarehouseLocations.FirstAsync()).Id;

    private async Task<Guid> SeedCollectorAsync(string name = "Test Collector")
    {
        var user = new User { Email = $"{Guid.NewGuid()}@test.com", FullName = name, PasswordHash = "x", Role = UserRole.Collector };
        var collector = new Collector { UserId = user.UserId, VehicleType = "Van", CapacityKg = 500 };
        _db.Users.Add(user);
        _db.Collectors.Add(collector);
        await _db.SaveChangesAsync();
        return collector.CollectorId;
    }

    private async Task<User> SeedStaffAsync(string name)
    {
        var user = new User { Email = $"{Guid.NewGuid()}@test.com", FullName = name, PasswordHash = "x", Role = UserRole.Staff };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    private async Task<ReceiveExtraWasteResponse> ReceiveMixedAsync(Guid collectorId, Guid staffId)
        => await _service.ReceiveAsync(new ReceiveExtraWasteRequest
        {
            CollectorId = collectorId,
            WarehouseLocationId = await LocationAsync(),
            Items =
            {
                new ReceiveExtraWasteItemRequest { ItemType = "Laptop", WeightKg = 2m, Accepted = true },
                new ReceiveExtraWasteItemRequest { ItemType = "Battery", WeightKg = 1m, Accepted = true },
                new ReceiveExtraWasteItemRequest { ItemType = "Broken CRT Monitor", WeightKg = 8.5m, Accepted = false, RejectionReason = "Not accepted at this site" }
            }
        }, staffId);

    // ---------------------------------------------------------------- rejected lines: Rs. 0, never in the payment

    [Fact]
    public async Task Receive_MixedAcceptedAndRejected_PaymentTotalCountsOnlyAcceptedLines()
    {
        var result = await ReceiveMixedAsync(await SeedCollectorAsync(), Guid.NewGuid());

        var payment = await _db.CollectorPayments.SingleAsync(p => p.SourceId == result.ExtraWasteReceiptId);

        // 2 kg Laptop × 50 + 1 kg Battery × 30 = 130. The rejected 8.5 kg adds nothing.
        Assert.Equal(130.00m, payment.Amount);
    }

    [Fact]
    public async Task Receive_MixedAcceptedAndRejected_SnapshotKeepsTheRejectedLineAtZero()
    {
        var result = await ReceiveMixedAsync(await SeedCollectorAsync(), Guid.NewGuid());

        var payment = await _db.CollectorPayments.SingleAsync(p => p.SourceId == result.ExtraWasteReceiptId);
        var lines = PaymentSnapshotSerializer.TryDeserialize(payment.CalculationSnapshot)!.ExtraWaste!.Lines;

        Assert.Equal(3, lines.Count);
        Assert.Equal(2, lines.Count(l => l.Accepted && l.IncludedInTotal));

        var rejected = lines.Single(l => !l.Accepted);
        Assert.Equal("Broken CRT Monitor", rejected.ItemType);
        Assert.Equal(8.5m, rejected.WeightKg);
        Assert.Equal("Not accepted at this site", rejected.RejectionReason);
        Assert.Equal(0m, rejected.Amount);
        Assert.False(rejected.IncludedInTotal);
        Assert.Equal(payment.Amount, lines.Where(l => l.IncludedInTotal).Sum(l => l.Amount));
    }

    [Fact]
    public async Task Receive_AllRejected_CreatesNoPaymentAndNoInventory_ButTheReceiptKeepsTheLines()
    {
        var result = await _service.ReceiveAsync(new ReceiveExtraWasteRequest
        {
            CollectorId = await SeedCollectorAsync(),
            WarehouseLocationId = await LocationAsync(),
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "Broken CRT Monitor", WeightKg = 8.5m, Accepted = false, RejectionReason = "Not e-waste" } }
        }, Guid.NewGuid());

        Assert.Equal(0, await _db.CollectorPayments.CountAsync());
        Assert.Equal(0, await _db.InventoryItems.CountAsync());

        var detail = await _service.GetDetailAsync(result.ExtraWasteReceiptId);
        Assert.Null(detail.Payment);
        var line = Assert.Single(detail.Items);
        Assert.False(line.Accepted);
        Assert.Equal("Not e-waste", line.RejectionReason);
        Assert.False(line.ContributesToPayment);
        Assert.Equal(0m, line.LineAmount);
    }

    [Fact]
    public async Task Receive_StampsTheAuthenticatedStaffAsTheReceiptAndPaymentCreator()
    {
        var staff = Guid.NewGuid();
        var result = await ReceiveMixedAsync(await SeedCollectorAsync(), staff);

        var payment = await _db.CollectorPayments.SingleAsync(p => p.SourceId == result.ExtraWasteReceiptId);
        var receipt = await _db.ExtraWasteReceipts.SingleAsync(r => r.Id == result.ExtraWasteReceiptId);

        Assert.Equal(staff, payment.CreatedByStaffId);
        Assert.Equal(staff, receipt.ReceivedByStaffId);
    }

    // ---------------------------------------------------------------- GeneralCollection is reserved

    [Theory]
    [InlineData("GeneralCollection")]
    [InlineData("generalcollection")]
    [InlineData("  GENERALCOLLECTION  ")]
    public async Task Receive_GeneralCollectionAsAnAcceptedItem_IsRejectedAndCreatesNothing(string itemType)
    {
        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = await SeedCollectorAsync(),
            WarehouseLocationId = await LocationAsync(),
            Items = { new ReceiveExtraWasteItemRequest { ItemType = itemType, WeightKg = 5m, Accepted = true } }
        };

        var ex = await Assert.ThrowsAsync<ArgumentException>(() => _service.ReceiveAsync(request, Guid.NewGuid()));

        Assert.Contains("reserved for job-collection", ex.Message);
        Assert.Equal(0, await _db.ExtraWasteReceipts.CountAsync());
        Assert.Equal(0, await _db.InventoryItems.CountAsync());
        Assert.Equal(0, await _db.CollectorPayments.CountAsync());
    }

    [Fact]
    public async Task Receive_GeneralCollectionEvenAsARejectedLine_IsRejected()
    {
        var request = new ReceiveExtraWasteRequest
        {
            CollectorId = await SeedCollectorAsync(),
            WarehouseLocationId = await LocationAsync(),
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "GeneralCollection", WeightKg = 5m, Accepted = false, RejectionReason = "no" } }
        };

        await Assert.ThrowsAsync<ArgumentException>(() => _service.ReceiveAsync(request, Guid.NewGuid()));
    }

    [Fact]
    public void Validator_GeneralCollection_IsAValidationError_OtherTypesAreFine()
    {
        var validator = new ReceiveExtraWasteRequestValidator();
        ReceiveExtraWasteRequest Build(string type) => new()
        {
            CollectorId = Guid.NewGuid(),
            WarehouseLocationId = Guid.NewGuid(),
            Items = { new ReceiveExtraWasteItemRequest { ItemType = type, WeightKg = 1m, Accepted = true } }
        };

        var bad = validator.Validate(Build(" generalCollection "));
        Assert.False(bad.IsValid);
        Assert.Contains(bad.Errors, e => e.ErrorMessage.Contains("reserved for job-collection"));

        Assert.True(validator.Validate(Build("Laptop")).IsValid);
    }

    [Fact]
    public async Task ExistingRule_JobPaymentStillUsesTheGeneralCollectionRate()
    {
        // Hiding GeneralCollection from extra waste must not break the job payment that depends on it.
        var payment = await _payments.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 10m, DistanceKm = 5m }, Guid.NewGuid());

        Assert.Equal(475.00m, payment.Amount);
    }

    // ---------------------------------------------------------------- receipt detail

    [Fact]
    public async Task GetDetailAsync_ShowsEveryLine_WithRatesAndWhatEachContributed()
    {
        var staff = await SeedStaffAsync("Receiving Staff");
        var result = await ReceiveMixedAsync(await SeedCollectorAsync("Amy Collector"), staff.UserId);

        var detail = await _service.GetDetailAsync(result.ExtraWasteReceiptId);

        Assert.Equal("Amy Collector", detail.CollectorName);
        Assert.Equal("Receiving Staff", detail.ReceivedByName);
        Assert.Equal(2, detail.AcceptedCount);
        Assert.Equal(1, detail.RejectedCount);
        Assert.Equal(11.5m, detail.TotalWeightKg);
        Assert.Equal(3m, detail.AcceptedWeightKg);
        Assert.NotNull(detail.Payment);
        Assert.Equal(130.00m, detail.Payment!.Amount);
        Assert.True(detail.Payment.HasSnapshot);
        Assert.Equal(3, detail.Items.Count);

        var laptop = detail.Items.Single(i => i.ItemType == "Laptop");
        Assert.True(laptop.ContributesToPayment);
        Assert.Equal(50m, laptop.RatePerKg);
        Assert.Equal(100m, laptop.LineAmount);
        Assert.NotNull(laptop.InventoryItemId);

        var battery = detail.Items.Single(i => i.ItemType == "Battery");
        Assert.Equal(30m, battery.LineAmount);

        var rejected = detail.Items.Single(i => !i.Accepted);
        Assert.False(rejected.ContributesToPayment);
        Assert.Equal(0m, rejected.LineAmount);
        Assert.Null(rejected.RatePerKg);
        Assert.Equal("Not accepted at this site", rejected.RejectionReason);
        Assert.Null(rejected.InventoryItemId);

        // Contributions add up to the payment — and the rejected line is not part of it.
        Assert.Equal(detail.Payment.Amount, detail.Items.Where(i => i.ContributesToPayment).Sum(i => i.LineAmount ?? 0m));
    }

    [Fact]
    public async Task GetDetailAsync_UsesTheSavedRates_NotTodaysRates()
    {
        var result = await ReceiveMixedAsync(await SeedCollectorAsync(), Guid.NewGuid());

        var laptopRate = await _db.RatePolicies.SingleAsync(r => r.ItemType == "Laptop" && r.IsActive);
        laptopRate.RatePerKg = 500m;
        await _db.SaveChangesAsync();

        var detail = await _service.GetDetailAsync(result.ExtraWasteReceiptId);

        Assert.Equal(50m, detail.Items.Single(i => i.ItemType == "Laptop").RatePerKg);
        Assert.Equal(130.00m, detail.Payment!.Amount);
    }

    [Fact]
    public async Task GetDetailAsync_OlderReceiptWithoutSnapshot_ShowsLinesButInventsNoRates()
    {
        var collectorId = await SeedCollectorAsync();
        var receipt = new ExtraWasteReceipt { CollectorId = collectorId, ReceivedByStaffId = Guid.NewGuid() };
        receipt.Items.Add(new ExtraWasteReceiptItem { ItemType = "Laptop", WeightKg = 2m, Accepted = true });
        receipt.Items.Add(new ExtraWasteReceiptItem { ItemType = "Junk", WeightKg = 1m, Accepted = false, RejectionReason = "Junk" });
        _db.ExtraWasteReceipts.Add(receipt);
        _db.CollectorPayments.Add(new CollectorPayment
        {
            SourceType = PaymentSourceType.ExtraWaste, SourceId = receipt.Id, CollectorId = collectorId, Amount = 100m
        });
        await _db.SaveChangesAsync();

        var detail = await _service.GetDetailAsync(receipt.Id);

        Assert.False(detail.Payment!.HasSnapshot);
        var laptop = detail.Items.Single(i => i.ItemType == "Laptop");
        Assert.Null(laptop.RatePerKg);
        Assert.Null(laptop.LineAmount);
        Assert.Equal(0m, detail.Items.Single(i => i.ItemType == "Junk").LineAmount); // rejected is always Rs. 0
    }

    [Fact]
    public async Task GetDetailAsync_UnknownReceipt_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetDetailAsync(Guid.NewGuid()));
    }

    // ---------------------------------------------------------------- receipt history

    [Fact]
    public async Task ListAsync_ReturnsNewestFirst_WithCountsAndPaymentInfo()
    {
        var collectorId = await SeedCollectorAsync("Amy Collector");
        var first = await ReceiveMixedAsync(collectorId, Guid.NewGuid());
        var allRejected = await _service.ReceiveAsync(new ReceiveExtraWasteRequest
        {
            CollectorId = collectorId,
            WarehouseLocationId = await LocationAsync(),
            Items = { new ReceiveExtraWasteItemRequest { ItemType = "Junk", WeightKg = 4m, Accepted = false, RejectionReason = "Not e-waste" } }
        }, Guid.NewGuid());

        var older = await _db.ExtraWasteReceipts.SingleAsync(r => r.Id == first.ExtraWasteReceiptId);
        older.ReceivedAt = DateTime.UtcNow.AddDays(-2);
        await _db.SaveChangesAsync();

        var page = await _service.ListAsync(new ExtraWasteReceiptListQuery());

        Assert.Equal(2, page.TotalCount);
        Assert.Equal(new[] { allRejected.ExtraWasteReceiptId, first.ExtraWasteReceiptId }, page.Items.Select(i => i.ReceiptId));

        var mixed = page.Items.Single(i => i.ReceiptId == first.ExtraWasteReceiptId);
        Assert.Equal("Amy Collector", mixed.CollectorName);
        Assert.Equal(3, mixed.ItemCount);
        Assert.Equal(2, mixed.AcceptedCount);
        Assert.Equal(1, mixed.RejectedCount);
        Assert.Equal(11.5m, mixed.TotalWeightKg);
        Assert.Equal(3m, mixed.AcceptedWeightKg);
        Assert.Equal(130.00m, mixed.PaymentAmount);
        Assert.Equal("Pending", mixed.PaymentStatus);

        var rejectedOnly = page.Items.Single(i => i.ReceiptId == allRejected.ExtraWasteReceiptId);
        Assert.Equal(1, rejectedOnly.RejectedCount);
        Assert.Null(rejectedOnly.PaymentId);
        Assert.Null(rejectedOnly.PaymentAmount);
    }

    [Fact]
    public async Task ListAsync_FiltersByCollector_AndPages()
    {
        var amy = await SeedCollectorAsync("Amy");
        var bob = await SeedCollectorAsync("Bob");
        for (var i = 0; i < 3; i++) await ReceiveMixedAsync(amy, Guid.NewGuid());
        await ReceiveMixedAsync(bob, Guid.NewGuid());

        var amyPage = await _service.ListAsync(new ExtraWasteReceiptListQuery { CollectorId = amy, Page = 2, PageSize = 2 });

        Assert.Equal(3, amyPage.TotalCount);
        Assert.Equal(2, amyPage.TotalPages);
        Assert.Single(amyPage.Items);
        Assert.All(amyPage.Items, i => Assert.Equal(amy, i.CollectorId));
    }

    [Fact]
    public void ListQueryValidator_BadPaging_IsInvalid()
    {
        var validator = new ExtraWasteReceiptListQueryValidator();
        Assert.True(validator.Validate(new ExtraWasteReceiptListQuery()).IsValid);
        Assert.False(validator.Validate(new ExtraWasteReceiptListQuery { Page = 0 }).IsValid);
        Assert.False(validator.Validate(new ExtraWasteReceiptListQuery { PageSize = 101 }).IsValid);
    }
}
