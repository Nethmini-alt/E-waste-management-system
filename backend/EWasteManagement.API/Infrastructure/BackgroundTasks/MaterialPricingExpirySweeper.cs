using EWasteManagement.API.Features.Sales.Services;

namespace EWasteManagement.API.Infrastructure.BackgroundTasks;

/// <summary>
/// Keeps material_pricing.Status honest: every Approved row whose expiry date has passed is
/// flipped to Expired, so staff screens and reports stop calling a dead price "Approved".
///
/// Correctness does not wait for this job. Every pricing lookup goes through
/// <see cref="MaterialPricingPolicy"/>, so an approved-but-expired row can never price an
/// order even if the sweep is late or the app was down over the expiry date. Runs once at
/// startup (which covers the "app was off" case) and then every <see cref="SweepInterval"/>.
/// </summary>
public class MaterialPricingExpirySweeper : BackgroundService
{
    /// <summary>Pricing dates are whole days, so four sweeps a day is plenty of slack.</summary>
    public static readonly TimeSpan SweepInterval = TimeSpan.FromHours(6);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MaterialPricingExpirySweeper> _logger;

    public MaterialPricingExpirySweeper(
        IServiceScopeFactory scopeFactory,
        ILogger<MaterialPricingExpirySweeper> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(SweepInterval);

        // Sweep first, then wait — so a restart after some downtime cleans up immediately.
        while (!stoppingToken.IsCancellationRequested)
        {
            await SweepOnceAsync(stoppingToken);

            try
            {
                if (!await timer.WaitForNextTickAsync(stoppingToken)) break;
            }
            catch (OperationCanceledException)
            {
                break;   // normal shutdown
            }
        }
    }

    private async Task SweepOnceAsync(CancellationToken ct)
    {
        try
        {
            // A background service outlives any single request, so it must open its own
            // scope (and therefore its own ApplicationDbContext) for each sweep.
            using var scope = _scopeFactory.CreateScope();
            var pricing = scope.ServiceProvider.GetRequiredService<IMaterialPricingService>();

            var expired = await pricing.ExpireStaleAsync(ct);
            if (expired > 0)
                _logger.LogInformation("Material pricing sweep marked {Count} row(s) Expired.", expired);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            // Shutting down mid-sweep — nothing was half-saved (single SaveChanges) so just stop.
        }
        catch (Exception ex)
        {
            // The next sweep retries, and pricing lookups are already safe by date, so a
            // failure here must never take the app down.
            _logger.LogError(ex, "Material pricing expiry sweep failed.");
        }
    }
}
