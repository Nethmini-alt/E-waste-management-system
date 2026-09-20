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

    [Fact]
    public async Task CreatePaymentAsync_JobSource_UsesJobCalculator()
    {
        var payment = await _service.CreatePaymentAsync(
            PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 10m, DistanceKm = 5m });

        Assert.Equal(475.00m, payment.Amount);
    }

    [Fact]
    public async Task CreatePaymentAsync_DuplicateSource_Throws()
    {
        var sourceId = Guid.NewGuid();
        await _service.CreatePaymentAsync(PaymentSourceType.Job, sourceId, Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 5m });

        await Assert.ThrowsAsync<DuplicatePaymentException>(() =>
            _service.CreatePaymentAsync(PaymentSourceType.Job, sourceId, Guid.NewGuid(),
                new PaymentContext { TotalWeightKg = 5m }));
    }

    [Fact]
    public async Task MarkPaidAsync_PendingPayment_SetsStatusAndPaidAt()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 5m });

        var paid = await _service.MarkPaidAsync(payment.Id);

        Assert.Equal(PaymentStatus.Paid, paid.Status);
        Assert.NotNull(paid.PaidAt);
    }

    [Fact]
    public async Task MarkPaidAsync_AlreadyPaid_Throws()
    {
        var payment = await _service.CreatePaymentAsync(PaymentSourceType.Job, Guid.NewGuid(), Guid.NewGuid(),
            new PaymentContext { TotalWeightKg = 5m });
        await _service.MarkPaidAsync(payment.Id);

        await Assert.ThrowsAsync<PaymentAlreadyPaidException>(() => _service.MarkPaidAsync(payment.Id));
    }
}