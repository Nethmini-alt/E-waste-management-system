using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class ItemTypeCatalogService : IItemTypeCatalogService
{
    private readonly ApplicationDbContext _db;
    public ItemTypeCatalogService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<string>> GetAllowedTypesAsync(CancellationToken cancellationToken = default)
    {
        var rateTypes = await _db.RatePolicies.AsNoTracking()
            .Where(r => r.IsActive)
            .Select(r => r.ItemType)
            .ToListAsync(cancellationToken);

        // Every priced material counts, whatever the price's status: an expired price must not stop a
        // worker from recording that a component exists. Sales still refuses to sell without a live price.
        var materialTypes = await _db.MaterialPricings.AsNoTracking()
            .Select(p => p.MaterialType)
            .Distinct()
            .ToListAsync(cancellationToken);

        // Rate-policy spelling wins, so job and dismantled items are named exactly like extra-waste items
        // (which are canonicalised against rate policies).
        var canonical = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
        foreach (var type in rateTypes.Concat(materialTypes))
        {
            var trimmed = type.Trim();
            if (trimmed.Length == 0 || IsReserved(trimmed)) continue;
            canonical.TryAdd(trimmed, trimmed);
        }

        return canonical.Values.OrderBy(t => t, StringComparer.OrdinalIgnoreCase).ToList();
    }

    public async Task<string?> ResolveAsync(string? itemType, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(itemType)) return null;

        var wanted = itemType.Trim();
        var allowed = await GetAllowedTypesAsync(cancellationToken);
        return allowed.FirstOrDefault(t => string.Equals(t, wanted, StringComparison.OrdinalIgnoreCase));
    }

    // "GeneralCollection" prices job payments; it is not a physical item type.
    private static bool IsReserved(string itemType)
        => string.Equals(itemType, JobPaymentCalculator.GeneralCollectionItemType, StringComparison.OrdinalIgnoreCase);
}
