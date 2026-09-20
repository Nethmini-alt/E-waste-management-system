using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class RatePolicyLookupService : IRatePolicyLookupService
{
    private readonly ApplicationDbContext _db;
    public RatePolicyLookupService(ApplicationDbContext db) => _db = db;

    // Matching is case-insensitive ("laptop" finds "Laptop"). The unique filtered index in
    // RatePolicyConfiguration is still case-sensitive, so two active rates that differ only by
    // case must not be created.
    public Task<RatePolicy?> GetActiveRateAsync(string itemType, CancellationToken cancellationToken = default)
    {
        var key = itemType.ToLowerInvariant();
        return _db.RatePolicies.AsNoTracking()
            .FirstOrDefaultAsync(r => r.IsActive && r.ItemType.ToLower() == key, cancellationToken);
    }
}