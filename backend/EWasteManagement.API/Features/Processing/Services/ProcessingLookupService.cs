using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class ProcessingLookupService : IProcessingLookupService
{
    private readonly ApplicationDbContext _db;
    public ProcessingLookupService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<WarehouseLocationLookupResponse>> GetWarehouseLocationsAsync(CancellationToken cancellationToken = default)
        => await _db.WarehouseLocations.AsNoTracking()
            .OrderBy(l => l.CreatedAt).ThenBy(l => l.Name)
            .Select(l => new WarehouseLocationLookupResponse { Id = l.Id, Name = l.Name, Description = l.Description })
            .ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<RatePolicyLookupResponse>> GetRatePoliciesAsync(bool activeOnly, CancellationToken cancellationToken = default)
    {
        var query = _db.RatePolicies.AsNoTracking().AsQueryable();
        if (activeOnly)
            query = query.Where(r => r.IsActive);

        return await query
            .OrderBy(r => r.ItemType)
            .Select(r => new RatePolicyLookupResponse
            {
                Id = r.Id, ItemType = r.ItemType, RatePerKg = r.RatePerKg, IsActive = r.IsActive, EffectiveFrom = r.EffectiveFrom
            })
            .ToListAsync(cancellationToken);
    }

    // A collector's name lives on their user account (Collector.UserId -> User). Only collectors
    // whose account is still active and not deleted are offered for new receipts.
    public async Task<IReadOnlyList<CollectorLookupResponse>> GetCollectorsAsync(CancellationToken cancellationToken = default)
        => await (from c in _db.Collectors.AsNoTracking()
                  join u in _db.Users.AsNoTracking() on c.UserId equals u.UserId
                  where u.IsActive && !u.IsDeleted
                  orderby u.FullName
                  select new CollectorLookupResponse { CollectorId = c.CollectorId, FullName = u.FullName, VehicleType = c.VehicleType })
            .ToListAsync(cancellationToken);
}
