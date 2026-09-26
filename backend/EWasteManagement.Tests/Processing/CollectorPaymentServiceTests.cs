using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Exceptions;
using EWasteManagement.API.Features.Processing.Services;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EWasteManagement.Tests.Processing;

public class CollectorPaymentServiceTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private CollectorPaymentService _service = null!;

    private static readonly Guid Staff = Guid.NewGuid();

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();

        var rates = new RatePolicyLookupService(_db);
        _service = new CollectorPaymentService(_db, new IPaymentCalculator[]
        {
            new JobPaymentCalculator(rates), new ExtraWastePaymentCalculator(rates)
        });
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private async Task<User> SeedStaffAsync(string name)
    {
        var user = new User { Email = $"{Guid.NewGuid()}@test.com", FullName = name, PasswordHash = "x", Role = UserRole.Staff };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();
        return user;
    }

    [Fact]
    public async Task CreatePaymentAsync_JobSource_UsesJobCalculator()
    {
        var payment = await _service.CreatePaymentAsync(
            PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 10m, DistanceKm = 5m }, Staff);

        Assert.Equal(475.00m, payment.Amount);
    }

    [Fact]
    public async Task CreatePaymentAsync_DuplicateSource_Throws()
    {
        var sourceId = Guid.NewGuid();
        await _service.CreatePaymentAsync(PaymentSourceType.Job, sourceId, Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 5m }, Staff);

        await Assert.ThrowsAsync<DuplicatePaymentException>(() =>
            _service.CreatePaymentAsync(PaymentSourceType.Job, sourceId, Guid.NewGuid(),
                new PaymentContext { TotalWeightKg = 5m }, Staff));
    }

    [Fact]
    public async Task MarkPaidAsync_PendingPayment_SetsStatusAndPaidAt()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 5m }, Staff);

        var paid = await _service.MarkPaidAsync(payment.Id, Staff);

        Assert.Equal(PaymentStatus.Paid, paid.Status);
        Assert.NotNull(paid.PaidAt);
    }

    [Fact]
    public async Task MarkPaidAsync_AlreadyPaid_Throws()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 5m }, Staff);
        await _service.MarkPaidAsync(payment.Id, Staff);

        await Assert.ThrowsAsync<PaymentAlreadyPaidException>(() => _service.MarkPaidAsync(payment.Id, Staff));
    }

    // ---------------------------------------------------------------- audit

    [Fact]
    public async Task CreatePaymentAsync_RecordsWhoCreatedIt_AndMarkPaidRecordsWhoPaid()
    {
        var creator = Guid.NewGuid();
        var payer = Guid.NewGuid();

        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 5m }, creator);

        Assert.Equal(creator, payment.CreatedByStaffId);
        Assert.Null(payment.PaidByStaffId);
        Assert.Null(payment.PaidAt);

        var paid = await _service.MarkPaidAsync(payment.Id, payer);

        Assert.Equal(payer, paid.PaidByStaffId);
        Assert.Equal(creator, paid.CreatedByStaffId); // creator is never overwritten
        Assert.NotNull(paid.PaidAt);
    }

    [Fact]
    public async Task MarkPaidAsync_DoesNotChangeTheAmountOrTheSavedSnapshot()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 10m, DistanceKm = 5m }, Staff);
        var snapshotBefore = payment.CalculationSnapshot;

        var paid = await _service.MarkPaidAsync(payment.Id, Guid.NewGuid());

        Assert.Equal(475.00m, paid.Amount);
        Assert.Equal(snapshotBefore, paid.CalculationSnapshot);
    }

    // ---------------------------------------------------------------- snapshot

    [Fact]
    public async Task CreatePaymentAsync_Job_SavesTheExactComponentsUsed()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 9.5m, DistanceKm = 5m, ReportedWeightKg = 10m }, Staff);

        var snapshot = PaymentSnapshotSerializer.TryDeserialize(payment.CalculationSnapshot)!;
        var job = snapshot.Job!;

        Assert.Equal("Job", snapshot.SourceType);
        Assert.Null(snapshot.ExtraWaste);
        Assert.Equal(465.00m, snapshot.TotalAmount);
        Assert.Equal(payment.Amount, snapshot.TotalAmount);

        Assert.Equal(9.5m, job.VerifiedWeightKg);
        Assert.Equal(10m, job.ReportedWeightKg);
        Assert.Equal(-0.5m, job.DiscrepancyKg);
        Assert.Equal("GeneralCollection", job.WeightRateItemType);
        Assert.Equal(20m, job.RatePerKg);          // seeded GeneralCollection rate
        Assert.Equal(190m, job.WeightAmount);      // 9.5 * 20
        Assert.Equal(200m, job.BaseFee);
        Assert.Equal(5m, job.DistanceKm);
        Assert.Equal(5m, job.DistanceUsedKm);
        Assert.Equal(15m, job.DistanceRatePerKm);
        Assert.Equal(75m, job.DistanceAmount);     // 5 * 15
        Assert.Equal(job.BaseFee + job.WeightAmount + job.DistanceAmount, snapshot.TotalAmount);
    }

    [Fact]
    public async Task CreatePaymentAsync_JobWithoutDistance_SnapshotShowsNullDistanceAndZeroUsed()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 10m, DistanceKm = null }, Staff);

        var job = PaymentSnapshotSerializer.TryDeserialize(payment.CalculationSnapshot)!.Job!;

        Assert.Null(job.DistanceKm);
        Assert.Equal(0m, job.DistanceUsedKm);
        Assert.Equal(0m, job.DistanceAmount);
        Assert.Equal(400m, payment.Amount); // 200 + 10*20 + 0 — same rule as before
    }

    [Fact]
    public async Task CreatePaymentAsync_ExtraWaste_SavesEachAcceptedLineWithItsRate()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.ExtraWaste, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext
            {
                TotalWeightKg = 3m,
                LineItems = new[] { new PaymentLineItem("Laptop", 2m), new PaymentLineItem("Battery", 1m) }
            }, Staff);

        var snapshot = PaymentSnapshotSerializer.TryDeserialize(payment.CalculationSnapshot)!;
        var lines = snapshot.ExtraWaste!.Lines;

        Assert.Equal("ExtraWaste", snapshot.SourceType);
        Assert.Null(snapshot.Job);
        Assert.Equal(130.00m, payment.Amount); // 2*50 + 1*30, unchanged rule
        Assert.Equal(130.00m, snapshot.TotalAmount);

        var laptop = lines.Single(l => l.ItemType == "Laptop");
        Assert.Equal(2m, laptop.WeightKg);
        Assert.Equal(50m, laptop.RatePerKg);
        Assert.Equal(100m, laptop.Amount);
        Assert.True(laptop.Accepted);
        Assert.True(laptop.IncludedInTotal);

        var battery = lines.Single(l => l.ItemType == "Battery");
        Assert.Equal(30m, battery.RatePerKg);
        Assert.Equal(30m, battery.Amount);
    }

    [Fact]
    public async Task CreatePaymentAsync_ExtraWaste_RejectedLinesAreSavedAtZeroAndNeverInTheTotal()
    {
        var withoutRejected = await _service.CreatePaymentAsync(PaymentSourceType.ExtraWaste, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { LineItems = new[] { new PaymentLineItem("Laptop", 2m) } }, Staff);

        var withRejected = await _service.CreatePaymentAsync(PaymentSourceType.ExtraWaste, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext
            {
                LineItems = new[] { new PaymentLineItem("Laptop", 2m) },
                RejectedLineItems = new[] { new RejectedLineItem("Broken CRT Monitor", 8.5m, "Not accepted at this site") }
            }, Staff);

        // The rejected 8.5 kg changes nothing about the amount.
        Assert.Equal(100.00m, withoutRejected.Amount);
        Assert.Equal(100.00m, withRejected.Amount);

        var lines = PaymentSnapshotSerializer.TryDeserialize(withRejected.CalculationSnapshot)!.ExtraWaste!.Lines;
        var rejected = lines.Single(l => !l.Accepted);
        Assert.Equal("Broken CRT Monitor", rejected.ItemType);
        Assert.Equal(8.5m, rejected.WeightKg);
        Assert.Equal("Not accepted at this site", rejected.RejectionReason);
        Assert.Equal(0m, rejected.Amount);
        Assert.Null(rejected.RatePerKg);
        Assert.False(rejected.IncludedInTotal);
        Assert.Equal(100m, lines.Where(l => l.IncludedInTotal).Sum(l => l.Amount));
    }

    [Fact]
    public async Task Snapshot_IsNotRecalculatedWhenRatesChangeLater()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.ExtraWaste, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { LineItems = new[] { new PaymentLineItem("Laptop", 2m) } }, Staff);
        Assert.Equal(100.00m, payment.Amount);

        // The Laptop rate is changed after the payment was created.
        var laptopRate = await _db.RatePolicies.SingleAsync(r => r.ItemType == "Laptop" && r.IsActive);
        laptopRate.RatePerKg = 999m;
        await _db.SaveChangesAsync();

        var detail = await _service.GetDetailAsync(payment.Id);

        Assert.True(detail.HasSnapshot);
        Assert.Equal(100.00m, detail.Amount);
        var line = detail.Snapshot!.ExtraWaste!.Lines.Single();
        Assert.Equal(50m, line.RatePerKg);   // the rate at creation time, not 999
        Assert.Equal(100m, line.Amount);
    }

    // ---------------------------------------------------------------- detail

    [Fact]
    public async Task GetDetailAsync_ReturnsCollectorCreatorAndPayerNames_AndDates()
    {
        var creator = await SeedStaffAsync("Creator Staff");
        var payer = await SeedStaffAsync("Paying Staff");
        var collectorUser = new User { Email = $"{Guid.NewGuid()}@test.com", FullName = "Amy Collector", PasswordHash = "secret", Role = UserRole.Collector };
        var collector = new Collector { UserId = collectorUser.UserId, VehicleType = "Van", CapacityKg = 500 };
        _db.Users.Add(collectorUser);
        _db.Collectors.Add(collector);
        await _db.SaveChangesAsync();

        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), collector.CollectorId,
            new PaymentContext { TotalWeightKg = 10m, DistanceKm = 5m }, creator.UserId);
        await _service.MarkPaidAsync(payment.Id, payer.UserId);

        var detail = await _service.GetDetailAsync(payment.Id);

        Assert.Equal("Amy Collector", detail.CollectorName);
        Assert.Equal("Van", detail.CollectorVehicleType);
        Assert.Equal("Creator Staff", detail.CreatedByName);
        Assert.Equal("Paying Staff", detail.PaidByName);
        Assert.Equal("Paid", detail.Status);
        Assert.NotNull(detail.PaidAt);
        Assert.Equal("Job", detail.SourceType);
        Assert.NotNull(detail.Job);
        Assert.Null(detail.Receipt);
    }

    [Fact]
    public async Task GetDetailAsync_UnknownPayment_ThrowsNotFound()
    {
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetDetailAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task GetDetailAsync_OldPaymentWithoutSnapshot_SaysNoBreakdown_AndNeverRecalculates()
    {
        // A payment created before snapshots/audit existed: no snapshot, no creator.
        var legacy = new CollectorPayment
        {
            SourceType = PaymentSourceType.Job, SourceId = Guid.NewGuid(), CollectorId = Guid.NewGuid(), Amount = 123.45m
        };
        _db.CollectorPayments.Add(legacy);
        await _db.SaveChangesAsync();

        var detail = await _service.GetDetailAsync(legacy.Id);

        Assert.False(detail.HasSnapshot);
        Assert.Null(detail.Snapshot);
        Assert.Equal(123.45m, detail.Amount); // untouched — not recomputed from today's rates
        Assert.Null(detail.CreatedByStaffId);
        Assert.Null(detail.CreatedByName);
    }

    [Fact]
    public async Task GetDetailAsync_ExtraWastePayment_ListsAcceptedAndRejectedReceiptLines()
    {
        var staffUser = await SeedStaffAsync("Receiving Staff");
        var receipt = new ExtraWasteReceipt { CollectorId = Guid.NewGuid(), ReceivedByStaffId = staffUser.UserId, Notes = "Drop-off" };
        var location = await _db.WarehouseLocations.FirstAsync();
        var accepted = new ExtraWasteReceiptItem { ItemType = "Laptop", WeightKg = 2m, Accepted = true };
        var rejected = new ExtraWasteReceiptItem { ItemType = "Broken CRT Monitor", WeightKg = 8.5m, Accepted = false, RejectionReason = "Not accepted" };
        receipt.Items.Add(accepted);
        receipt.Items.Add(rejected);
        _db.ExtraWasteReceipts.Add(receipt);
        await _db.SaveChangesAsync();
        _ = location;

        var payment = await _service.CreatePaymentAsync(PaymentSourceType.ExtraWaste, receipt.Id, receipt.CollectorId,
            new PaymentContext
            {
                LineItems = new[] { new PaymentLineItem("Laptop", 2m, accepted.Id) },
                RejectedLineItems = new[] { new RejectedLineItem("Broken CRT Monitor", 8.5m, "Not accepted", rejected.Id) }
            }, staffUser.UserId);

        var detail = await _service.GetDetailAsync(payment.Id);

        Assert.NotNull(detail.Receipt);
        Assert.Equal("Drop-off", detail.Receipt!.Notes);
        Assert.Equal("Receiving Staff", detail.Receipt.ReceivedByName);
        Assert.Equal(2, detail.Receipt.Items.Count);
        Assert.Contains(detail.Receipt.Items, i => !i.Accepted && i.RejectionReason == "Not accepted");
        Assert.Equal("Receiving Staff", detail.CreatedByName);
    }

    [Fact]
    public async Task GetDetailAsync_OldExtraWastePayment_TakesTheCreatorFromTheReceipt()
    {
        var staffUser = await SeedStaffAsync("Receiving Staff");
        var receipt = new ExtraWasteReceipt { CollectorId = Guid.NewGuid(), ReceivedByStaffId = staffUser.UserId };
        _db.ExtraWasteReceipts.Add(receipt);
        var legacy = new CollectorPayment { SourceType = PaymentSourceType.ExtraWaste, SourceId = receipt.Id, CollectorId = receipt.CollectorId, Amount = 50m };
        _db.CollectorPayments.Add(legacy);
        await _db.SaveChangesAsync();

        var detail = await _service.GetDetailAsync(legacy.Id);

        Assert.False(detail.HasSnapshot);
        Assert.Equal(staffUser.UserId, detail.CreatedByStaffId);
        Assert.Equal("Receiving Staff", detail.CreatedByName);
    }
}
