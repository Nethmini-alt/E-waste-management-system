using EWasteManagement.API.Features.Sales.Services;

namespace EWasteManagement.API.Infrastructure.BackgroundTasks;

public class MaterialRestockQueueProcessor : BackgroundService
{
    private readonly IMaterialRestockQueue _queue;
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MaterialRestockQueueProcessor> _logger;

    public MaterialRestockQueueProcessor(
        IMaterialRestockQueue queue,
        IServiceScopeFactory scopeFactory,
        ILogger<MaterialRestockQueueProcessor> logger)
    {
        _queue = queue;
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await RecheckAsync(stoppingToken);
        await Task.WhenAll(ConsumeQueueAsync(stoppingToken), RetryWaitingRequestsAsync(stoppingToken));
    }

    private async Task ConsumeQueueAsync(CancellationToken stoppingToken)
    {
        await foreach (var inventoryItemId in _queue.DequeueAllAsync(stoppingToken))
        {
            await using var scope = _scopeFactory.CreateAsyncScope();
            try
            {
                var matcher = scope.ServiceProvider.GetRequiredService<IMaterialRestockMatcher>();
                await matcher.MatchInventoryAsync(inventoryItemId, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process inventory restock {InventoryItemId}", inventoryItemId);
            }
        }
    }

    private async Task RetryWaitingRequestsAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            await RecheckAsync(stoppingToken);
        }
    }

    private async Task RecheckAsync(CancellationToken cancellationToken)
    {
        await using var scope = _scopeFactory.CreateAsyncScope();
        try
        {
            var matcher = scope.ServiceProvider.GetRequiredService<IMaterialRestockMatcher>();
            await matcher.RecheckWaitingRequestsAsync(cancellationToken);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to recheck waiting material requests");
        }
    }
}