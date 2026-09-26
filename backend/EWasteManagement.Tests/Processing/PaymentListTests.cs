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

public class PaymentListTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private CollectorPaymentService _payments = null!;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();
        _payments = new CollectorPaymentService(_db, Array.Empty<IPaymentCalculator>());
    }

    public async Task DisposeAsync() { await _db.DisposeAsync(); await _connection.DisposeAsync(); }

    private async Task<Guid> SeedCollectorAsync(string fullName, string vehicle)
    {
        var user = new User { Email = $"{Guid.NewGuid()}@test.com", FullName = fullName, PasswordHash = "x", Role = UserRole.Collector };
        var collector = new Collector { UserId = user.UserId, VehicleType = vehicle, CapacityKg = 500 };
        _db.Users.Add(user);
        _db.Collectors.Add(collector);
        await _db.SaveChangesAsync();
        return collector.CollectorId;
    }

    private async Task<CollectorPayment> SeedPaymentAsync(
        Guid collectorId, decimal amount, PaymentStatus status = PaymentStatus.Pending,
        PaymentSourceType source = PaymentSourceType.Job, DateTime? createdAt = null, DateTime? paidAt = null)
    {
        var payment = new CollectorPayment
        {
            SourceType = source, SourceId = Guid.NewGuid(), CollectorId = collectorId, Amount = amount,
            Status = status, CreatedAt = createdAt ?? DateTime.UtcNow, PaidAt = paidAt
        };
        _db.CollectorPayments.Add(payment);
        await _db.SaveChangesAsync();
        return payment;
    }

    [Fact]
    public async Task ListAsync_NoStatusFilter_ReturnsPendingAndPaidNewestFirstWithBothTotals()
    {
        var collector = await SeedCollectorAsync("Amy Collector", "Van");
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        var oldPaid = await SeedPaymentAsync(collector, 100m, PaymentStatus.Paid, createdAt: start, paidAt: start.AddDays(1));
        var newPending = await SeedPaymentAsync(collector, 250.50m, createdAt: start.AddDays(5));

        var result = await _payments.ListAsync(new PaymentListQuery());

        Assert.Equal(2, result.TotalCount);
        Assert.Equal(new[] { newPending.Id, oldPaid.Id }, result.Items.Select(i => i.Id));
        Assert.Equal(250.50m, result.TotalPendingAmount);
        Assert.Equal(100m, result.TotalPaidAmount);
    }

    [Fact]
    public async Task ListAsync_ReturnsCollectorNameAndVehicle()
    {
        var collector = await SeedCollectorAsync("Amy Collector", "Van");
        await SeedPaymentAsync(collector, 10m);

        var item = Assert.Single((await _payments.ListAsync(new PaymentListQuery())).Items);

        Assert.Equal("Amy Collector", item.CollectorName);
        Assert.Equal("Van", item.CollectorVehicleType);
        Assert.Equal("Pending", item.Status);
        Assert.Equal("Job", item.SourceType);
        Assert.Null(item.PaidAt);
    }

    [Fact]
    public async Task ListAsync_UnknownCollector_StillReturnsThePaymentWithNullName()
    {
        await SeedPaymentAsync(Guid.NewGuid(), 10m);

        var item = Assert.Single((await _payments.ListAsync(new PaymentListQuery())).Items);

        Assert.Null(item.CollectorName);
        Assert.Null(item.CollectorVehicleType);
    }

    [Fact]
    public async Task ListAsync_StatusPending_ReturnsOldestFirst_AndTotalsIgnoreTheStatusFilter()
    {
        var collector = await SeedCollectorAsync("Amy Collector", "Van");
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        var older = await SeedPaymentAsync(collector, 10m, createdAt: start);
        var newer = await SeedPaymentAsync(collector, 20m, createdAt: start.AddDays(1));
        await SeedPaymentAsync(collector, 5m, PaymentStatus.Paid, paidAt: start);

        var result = await _payments.ListAsync(new PaymentListQuery { Status = PaymentStatus.Pending });

        Assert.Equal(new[] { older.Id, newer.Id }, result.Items.Select(i => i.Id));
        Assert.Equal(2, result.TotalCount);
        Assert.Equal(30m, result.TotalPendingAmount);
        Assert.Equal(5m, result.TotalPaidAmount);
    }

    [Fact]
    public async Task ListAsync_StatusPaid_ReturnsMostRecentlyPaidFirst()
    {
        var collector = await SeedCollectorAsync("Amy Collector", "Van");
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        var paidEarly = await SeedPaymentAsync(collector, 10m, PaymentStatus.Paid, paidAt: start);
        var paidLate = await SeedPaymentAsync(collector, 20m, PaymentStatus.Paid, paidAt: start.AddDays(3));
        await SeedPaymentAsync(collector, 99m);

        var result = await _payments.ListAsync(new PaymentListQuery { Status = PaymentStatus.Paid });

        Assert.Equal(new[] { paidLate.Id, paidEarly.Id }, result.Items.Select(i => i.Id));
        Assert.All(result.Items, i => Assert.NotNull(i.PaidAt));
    }

    [Fact]
    public async Task ListAsync_FiltersByCollectorAndSourceType_AndTotalsFollowThoseFilters()
    {
        var amy = await SeedCollectorAsync("Amy Collector", "Van");
        var bob = await SeedCollectorAsync("Bob Collector", "Truck");
        await SeedPaymentAsync(amy, 10m, source: PaymentSourceType.Job);
        await SeedPaymentAsync(amy, 20m, source: PaymentSourceType.ExtraWaste);
        await SeedPaymentAsync(bob, 40m, source: PaymentSourceType.Job);

        var amyOnly = await _payments.ListAsync(new PaymentListQuery { CollectorId = amy });
        var amyExtra = await _payments.ListAsync(new PaymentListQuery { CollectorId = amy, SourceType = PaymentSourceType.ExtraWaste });

        Assert.Equal(2, amyOnly.TotalCount);
        Assert.Equal(30m, amyOnly.TotalPendingAmount);
        Assert.Equal(1, amyExtra.TotalCount);
        Assert.Equal(20m, amyExtra.TotalPendingAmount);
    }

    [Fact]
    public async Task ListAsync_Pages()
    {
        var collector = await SeedCollectorAsync("Amy Collector", "Van");
        var start = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        for (var i = 0; i < 5; i++)
            await SeedPaymentAsync(collector, i + 1, createdAt: start.AddDays(i));

        var page2 = await _payments.ListAsync(new PaymentListQuery { Status = PaymentStatus.Pending, Page = 2, PageSize = 2 });

        Assert.Equal(5, page2.TotalCount);
        Assert.Equal(3, page2.TotalPages);
        Assert.Equal(new[] { 3m, 4m }, page2.Items.Select(i => i.Amount));
    }

    [Fact]
    public async Task ListAsync_AfterMarkPaid_MovesFromPendingToPaidWithADate()
    {
        var collector = await SeedCollectorAsync("Amy Collector", "Van");
        var payment = await SeedPaymentAsync(collector, 75m);

        await _payments.MarkPaidAsync(payment.Id, Guid.NewGuid());

        var pending = await _payments.ListAsync(new PaymentListQuery { Status = PaymentStatus.Pending });
        var paid = await _payments.ListAsync(new PaymentListQuery { Status = PaymentStatus.Paid });

        Assert.Empty(pending.Items);
        Assert.Equal(0m, pending.TotalPendingAmount);
        var item = Assert.Single(paid.Items);
        Assert.NotNull(item.PaidAt);
        Assert.Equal(75m, paid.TotalPaidAmount);
    }

    [Fact]
    public void Validator_BadPagingOrUndefinedEnums_AreInvalid()
    {
        var validator = new PaymentListQueryValidator();

        Assert.True(validator.Validate(new PaymentListQuery()).IsValid);
        Assert.False(validator.Validate(new PaymentListQuery { Page = 0 }).IsValid);
        Assert.False(validator.Validate(new PaymentListQuery { PageSize = 101 }).IsValid);
        Assert.False(validator.Validate(new PaymentListQuery { Status = (PaymentStatus)99 }).IsValid);
        Assert.False(validator.Validate(new PaymentListQuery { SourceType = (PaymentSourceType)99 }).IsValid);
    }
}
