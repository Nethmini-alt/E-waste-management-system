using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class RatePolicyLookupService : IRatePolicyLookupService
{
    private readonly ApplicationDbContext _db;
    public RatePolicyLookupService(ApplicationDbContext db) => _db = db;

    // The unique filtered index on (ItemType, IsActive=true) in RatePolicyConfiguration
    // guarantees at most one row matches — that's what makes this safe without an OrderBy.
    public Task<RatePolicy?> GetActiveRateAsync(string itemType, CancellationToken cancellationToken = default)
        => _db.RatePolicies.AsNoTracking()
            .FirstOrDefaultAsync(r => r.ItemType == itemType && r.IsActive, cancellationToken);
}