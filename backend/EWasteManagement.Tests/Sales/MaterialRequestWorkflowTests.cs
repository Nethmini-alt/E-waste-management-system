using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Events;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Features.Sales.Services;
using EWasteManagement.API.Infrastructure.BackgroundTasks;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.Tests.TestHelpers;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

namespace EWasteManagement.Tests.Sales;

public class MaterialRequestWorkflowTests : IAsyncLifetime
{
    private SqliteConnection _connection = null!;
    private ApplicationDbContext _db = null!;
    private Buyer _buyer = null!;
    private Guid _locationId;

    public async Task InitializeAsync()
    {
        _connection = new SqliteConnection("Data Source=:memory:");
        await _connection.OpenAsync();
        var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
        _db = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
        await _db.Database.EnsureCreatedAsync();

        var user = new User
        {
            Email = "buyer@example.test",
            FullName = "Test Buyer",
            PasswordHash = "test-hash",
            Role = UserRole.Corporate
        };
        _buyer = new Buyer
        {
            UserId = user.UserId,
            CompanyName = "Test Recycling Ltd",
            ContactPerson = "Test Buyer",
            Email = user.Email,
            Status = BuyerStatus.Active
        };
        var location = new WarehouseLocation { Name = "Ready Stock" };
        _db.AddRange(user, _buyer, location);
        await _db.SaveChangesAsync();
        _db.MaterialPricings.Add(new MaterialPricing
        {
            MaterialType = "Copper",
            PricePerKg = 100m,
            EffectiveDate = MaterialPricingPolicy.Today,
            Status = PricingStatus.Approved,
            CreatedByUserId = user.UserId
        });
        await _db.SaveChangesAsync();
        _locationId = location.Id;
    }

    public async Task DisposeAsync()
    {
        await _db.DisposeAsync();
        await _connection.DisposeAsync();
    }

    [Fact]
    public async Task CreateAsync_PersistsWaitingRequestAndQueuesAlreadyReadyStock()
    {
        var item = await SeedReadyInventoryAsync("Copper", 100m);
        var queue = new RecordingMaterialRestockQueue();
        var service = new MaterialRequestService(_db, queue);

        var request = await service.CreateAsync(_buyer.UserId,
            new CreateMaterialRequestRequest { MaterialType = " Copper ", QuantityKg = 25m });

        Assert.Equal("Waiting", request.Status);
        Assert.Equal("Copper", request.MaterialType);
        Assert.Contains(item.Id, queue.InventoryIds);
        var order = await _db.SalesOrders.SingleAsync();
        Assert.Equal(SalesOrderStatus.WaitingForStock, order.Status);
        Assert.Equal(request.MaterialRequestId, order.MaterialRequestId);
    }

    [Fact]
    public async Task GetMineAndGetAll_ReturnRequestsWithBuyerName()
    {
        _db.MaterialRequests.Add(NewRequest("Copper", 25m));
        await _db.SaveChangesAsync();
        var service = new MaterialRequestService(_db, new RecordingMaterialRestockQueue());

        var mine = await service.GetMineAsync(_buyer.UserId);
        var all = await service.GetAllAsync();

        Assert.Equal("Test Recycling Ltd", Assert.Single(mine).BuyerCompanyName);
        Assert.Equal("Test Recycling Ltd", Assert.Single(all).BuyerCompanyName);
    }

    [Fact]
    public async Task CreateAsync_ExportBuyerRequestBelowShipmentMinimum_IsRejected()
    {
        _buyer.BuyerType = BuyerType.Export;
        await _db.SaveChangesAsync();
        var service = new MaterialRequestService(_db, new RecordingMaterialRestockQueue());

        await Assert.ThrowsAsync<InvalidOperationException>(() => service.CreateAsync(_buyer.UserId,
            new CreateMaterialRequestRequest { MaterialType = "Copper", QuantityKg = 19.999m }));
    }

    [Fact]
    public async Task InventoryStatusHandler_ReadyForSale_QueuesRestockOnce()
    {
        var item = await SeedReadyInventoryAsync("Copper", 100m);
        var queue = new RecordingMaterialRestockQueue();
        var handler = new InventoryStatusChangedEventHandler(_db, queue);
        var readyEvent = new InventoryStatusChangedEvent(item.Id, InventoryStatus.Classified,
            InventoryStatus.ReadyForSale, Guid.NewGuid(), null);

        await handler.Handle(readyEvent);

        Assert.Equal(new[] { item.Id }, queue.InventoryIds);
        Assert.Single(await _db.ProcessingLogs.ToListAsync());
    }

    [Fact]
    public async Task MatchInventoryAsync_InsufficientAvailableStock_LeavesRequestWaiting()
    {
        var item = await SeedReadyInventoryAsync("Copper", 100m);
        var request = NewRequest("Copper", 75m);
        _db.MaterialRequests.Add(request);
        await _db.SaveChangesAsync();
        var agent = new RecordingSalesAgent(_connection, item.Id);
        var matcher = CreateMatcher(agent, AvailableMaterial("Copper", 50m, item.Id));

        await matcher.MatchInventoryAsync(item.Id);

        Assert.Equal(MaterialRequestStatus.Waiting,
            (await _db.MaterialRequests.SingleAsync()).Status);
        Assert.Empty(agent.Goals);
    }

    [Fact]
    public async Task MatchInventoryAsync_EnoughStock_GeneratesAndLinksBuyerTargetedPlan()
    {
        var item = await SeedReadyInventoryAsync("Copper", 100m);
        var request = NewRequest("Copper", 75m);
        _db.MaterialRequests.Add(request);
        await _db.SaveChangesAsync();
        var agent = new RecordingSalesAgent(_connection, item.Id);
        var logger = new RecordingLogger<MaterialRestockMatcher>();
        var matcher = new MaterialRestockMatcher(_db,
            new FixedRecoveredMaterialsProvider(new[] { AvailableMaterial("Copper", 100m, item.Id) }), agent, logger);

        await matcher.MatchInventoryAsync(item.Id);

        Assert.Single(agent.Goals);
        Assert.True(logger.Exceptions.Count == 0, string.Join(Environment.NewLine, logger.Exceptions.Select(exception =>
            exception is DbUpdateConcurrencyException concurrency
                ? $"{exception.Message}; entries: {string.Join(", ", concurrency.Entries.Select(entry => entry.Metadata.ClrType.Name))}"
                : exception.ToString())));
        _db.ChangeTracker.Clear();
        var updated = await _db.MaterialRequests.SingleAsync();
        var goal = Assert.Single(agent.Goals);
        Assert.Equal(MaterialRequestStatus.PlanGenerated, updated.Status);
        Assert.Equal(goal.GeneratedPlanId, updated.CommercialPlanId);
        Assert.Equal(_buyer.BuyerId, goal.Goal!.TargetBuyerId);
        Assert.Equal(new[] { "Copper" }, goal.Goal.TargetMaterialTypes);
        Assert.Equal(75m, goal.Goal.MaxQuantityKg);
        Assert.Equal("LocalSale", goal.Goal.PreferredRoute);
        var order = await _db.SalesOrders.Include(row => row.Items).SingleAsync();
        Assert.Equal(SalesOrderStatus.PendingPlanApproval, order.Status);
        Assert.Null(order.PendingMaterialType);
        Assert.Equal(7_500m, order.TotalAmount);
        Assert.Equal(item.Id, Assert.Single(order.Items).RecoveredMaterialId);
    }

    [Fact]
    public async Task MatchInventoryAsync_AgentFailure_MarksRetryAndLeavesOrderAsBackorder()
    {
        var item = await SeedReadyInventoryAsync("Copper", 100m);
        _db.MaterialRequests.Add(NewRequest("Copper", 75m));
        await _db.SaveChangesAsync();
        var agent = new RecordingSalesAgent(_connection, item.Id) { ShouldFail = true };
        var matcher = CreateMatcher(agent, AvailableMaterial("Copper", 100m, item.Id));

        await matcher.MatchInventoryAsync(item.Id);

        var request = await _db.MaterialRequests.SingleAsync();
        var order = await _db.SalesOrders.SingleAsync();
        Assert.Equal(MaterialRequestStatus.PlanGenerationFailed, request.Status);
        Assert.Equal(SalesOrderStatus.WaitingForStock, order.Status);
    }

    [Fact]
    public async Task ApprovePlan_ConvertsLinkedBackorderToDraftSalesOrder()
    {
        var request = NewRequest("Copper", 75m);
        var plan = new CommercialPlan
        {
            WorkflowId = Guid.NewGuid(),
            RecommendedRoute = CommercialRoute.LocalSale,
            SelectedBuyerId = _buyer.BuyerId,
            ReasoningSummary = "Buyer-targeted restock plan",
            Status = CommercialPlanStatus.PendingApproval
        };
        request.Status = MaterialRequestStatus.PlanGenerated;
        request.CommercialPlan = plan;
        request.SalesOrder!.Status = SalesOrderStatus.PendingPlanApproval;
        request.SalesOrder.PendingMaterialType = null;
        request.SalesOrder.PendingQuantityKg = null;
        _db.AddRange(request, plan);
        await _db.SaveChangesAsync();
        var service = new CommercialPlanService(_db);

        await service.DecideAsync(plan.CommercialPlanId,
            new ApprovalDecisionRequest { Decision = "Approved" }, _buyer.UserId);

        Assert.Equal(MaterialRequestStatus.OrderPlaced,
            (await _db.MaterialRequests.SingleAsync()).Status);
        Assert.Equal(SalesOrderStatus.Draft,
            (await _db.SalesOrders.SingleAsync()).Status);
    }

    private MaterialRestockMatcher CreateMatcher(RecordingSalesAgent agent, params RecoveredMaterialResponse[] available)
        => new(_db, new FixedRecoveredMaterialsProvider(available), agent, NullLogger<MaterialRestockMatcher>.Instance);

    private MaterialRequest NewRequest(string materialType, decimal quantityKg)
    {
        var request = new MaterialRequest
        {
            BuyerId = _buyer.BuyerId,
            MaterialType = materialType,
            QuantityKg = quantityKg
        };
        request.SalesOrder = new SalesOrder
        {
            BuyerId = _buyer.BuyerId,
            MaterialRequest = request,
            PendingMaterialType = materialType,
            PendingQuantityKg = quantityKg,
            Status = SalesOrderStatus.WaitingForStock,
            CreatedByUserId = _buyer.UserId
        };
        return request;
    }

    private async Task<InventoryItem> SeedReadyInventoryAsync(string materialType, decimal quantityKg)
    {
        var item = new InventoryItem
        {
            OriginType = OriginType.ExtraWaste,
            ItemType = materialType,
            VerifiedWeightKg = quantityKg,
            CurrentLocationId = _locationId
        };
        item.TransitionTo(InventoryStatus.Sorting, Guid.NewGuid());
        item.TransitionTo(InventoryStatus.Classified, Guid.NewGuid());
        item.TransitionTo(InventoryStatus.ReadyForSale, Guid.NewGuid());
        _db.InventoryItems.Add(item);
        await _db.SaveChangesAsync();
        return item;
    }

    private static RecoveredMaterialResponse AvailableMaterial(string materialType, decimal quantityKg, Guid id) => new()
    {
        RecoveredMaterialId = id,
        MaterialType = materialType,
        QuantityKg = quantityKg,
        ProcessingStatus = "Ready",
        SafetyValidated = true
    };

    private sealed class RecordingMaterialRestockQueue : IMaterialRestockQueue
    {
        public List<Guid> InventoryIds { get; } = new();
        public void Enqueue(Guid inventoryItemId) => InventoryIds.Add(inventoryItemId);
        public IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken cancellationToken)
            => throw new NotImplementedException();
    }

    private sealed class FixedRecoveredMaterialsProvider : IRecoveredMaterialsProvider
    {
        private readonly IReadOnlyList<RecoveredMaterialResponse> _available;
        public FixedRecoveredMaterialsProvider(IReadOnlyList<RecoveredMaterialResponse> available) => _available = available;
        public Task<IReadOnlyList<RecoveredMaterialResponse>> GetAllAsync(CancellationToken ct = default)
            => Task.FromResult(_available);
        public Task<IReadOnlyList<RecoveredMaterialResponse>> GetAvailableAsync(CancellationToken ct = default)
            => Task.FromResult(_available);
        public Task<RecoveredMaterialResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
            => Task.FromResult(_available.FirstOrDefault(material => material.RecoveredMaterialId == id));
    }

    private sealed class RecordingSalesAgent : IAgentClient
    {
        private readonly SqliteConnection _connection;
        private readonly Guid _inventoryItemId;
        public List<(AgentRunGoal? Goal, Guid GeneratedPlanId)> Goals { get; } = new();
        public bool ShouldFail { get; set; }
        public RecordingSalesAgent(SqliteConnection connection, Guid inventoryItemId)
        {
            _connection = connection;
            _inventoryItemId = inventoryItemId;
        }

        public async Task<Guid> RunAgentAsync(AgentRunGoal? goal = null, CancellationToken ct = default)
        {
            if (ShouldFail)
                throw new InvalidOperationException("Sales agent is unavailable.");

            var plan = new CommercialPlan
            {
                WorkflowId = Guid.NewGuid(),
                SelectedBuyerId = goal?.TargetBuyerId,
                ReasoningSummary = "Test generated plan",
                MaterialsJson = $"[{{\"materialType\":\"Copper\",\"quantityKg\":75,\"recoveredMaterialId\":\"{_inventoryItemId}\"}}]"
            };
            var options = new DbContextOptionsBuilder<ApplicationDbContext>().UseSqlite(_connection).Options;
            await using var agentDb = new ApplicationDbContext(options, new NoOpDomainEventDispatcher());
            agentDb.CommercialPlans.Add(plan);
            await agentDb.SaveChangesAsync(ct);
            Goals.Add((goal, plan.CommercialPlanId));
            return plan.CommercialPlanId;
        }
    }

    private sealed class RecordingLogger<T> : ILogger<T>
    {
        public List<Exception> Exceptions { get; } = new();
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (exception is not null)
                Exceptions.Add(exception);
        }
    }

}