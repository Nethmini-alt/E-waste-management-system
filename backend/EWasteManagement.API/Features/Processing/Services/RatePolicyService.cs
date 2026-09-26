using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Processing.Exceptions;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class RatePolicyService : IRatePolicyService
{
    private readonly ApplicationDbContext _db;
    public RatePolicyService(ApplicationDbContext db) => _db = db;

    public async Task<RatePolicyLookupResponse> CreateAsync(CreateRatePolicyRequest request, CancellationToken cancellationToken = default)
    {
        var requested = request.ItemType.Trim();
        if (requested.Length == 0)
            throw new ArgumentException("ItemType is required.");

        var sameType = await RowsForTypeAsync(requested, cancellationToken);
        var active = sameType.FirstOrDefault(r => r.IsActive);
        if (active is not null)
            throw new DuplicateActiveRatePolicyException(active.ItemType);

        // Re-adding a type that existed before keeps its original spelling, so inventory items already
        // named after it still match.
        var itemType = sameType.OrderBy(r => r.CreatedAt).FirstOrDefault()?.ItemType ?? requested;

        var rate = NewActiveRate(itemType, request.RatePerKg);
        _db.RatePolicies.Add(rate);
        await SaveGuardingUniqueIndexAsync(itemType, cancellationToken);
        return Map(rate);
    }

    public async Task<RatePolicyLookupResponse> ReviseAsync(Guid id, ReviseRatePolicyRequest request, CancellationToken cancellationToken = default)
    {
        var current = await LoadAsync(id, cancellationToken);
        if (!current.IsActive)
            throw new InvalidOperationException("Only an active rate can be revised. Restore it first.");
        if (current.RatePerKg == request.RatePerKg)
            throw new ArgumentException($"The rate for '{current.ItemType}' is already {request.RatePerKg:0.00} per kg.");

        // Two saves in one transaction: the old row must be off before the new one goes in, or the
        // one-active-rate-per-type index would reject the insert.
        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);

        current.IsActive = false;
        await _db.SaveChangesAsync(cancellationToken);

        var revised = NewActiveRate(current.ItemType, request.RatePerKg);
        _db.RatePolicies.Add(revised);
        await SaveGuardingUniqueIndexAsync(current.ItemType, cancellationToken);

        await transaction.CommitAsync(cancellationToken);
        return Map(revised);
    }

    public async Task<RatePolicyLookupResponse> DeactivateAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var rate = await LoadAsync(id, cancellationToken);
        if (IsGeneralCollection(rate.ItemType))
            throw new InvalidOperationException(
                $"'{JobPaymentCalculator.GeneralCollectionItemType}' prices every job payment and cannot be deactivated. Revise it instead.");
        if (!rate.IsActive)
            throw new InvalidOperationException($"The rate for '{rate.ItemType}' is already inactive.");

        rate.IsActive = false;
        await _db.SaveChangesAsync(cancellationToken);
        return Map(rate);
    }

    public async Task<RatePolicyLookupResponse> RestoreAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var old = await LoadAsync(id, cancellationToken);
        if (old.IsActive)
            throw new InvalidOperationException($"The rate for '{old.ItemType}' is already active.");

        var sameType = await RowsForTypeAsync(old.ItemType, cancellationToken);
        if (sameType.Any(r => r.IsActive))
            throw new DuplicateActiveRatePolicyException(old.ItemType);

        var restored = NewActiveRate(old.ItemType, old.RatePerKg);
        _db.RatePolicies.Add(restored);
        await SaveGuardingUniqueIndexAsync(old.ItemType, cancellationToken);
        return Map(restored);
    }

    // ---------------------------------------------------------------- helpers

    private async Task<RatePolicy> LoadAsync(Guid id, CancellationToken cancellationToken)
        => await _db.RatePolicies.FirstOrDefaultAsync(r => r.Id == id, cancellationToken)
            ?? throw new KeyNotFoundException($"Rate policy '{id}' was not found.");

    // Case-insensitive, matching how payments look rates up (RatePolicyLookupService).
    private Task<List<RatePolicy>> RowsForTypeAsync(string itemType, CancellationToken cancellationToken)
    {
        var key = itemType.Trim().ToLowerInvariant();
        return _db.RatePolicies.AsNoTracking()
            .Where(r => r.ItemType.ToLower() == key)
            .ToListAsync(cancellationToken);
    }

    private static RatePolicy NewActiveRate(string itemType, decimal ratePerKg)
        => new() { ItemType = itemType, RatePerKg = ratePerKg, IsActive = true, EffectiveFrom = DateTime.UtcNow };

    // The unique index is the backstop when two admins add the same type at the same moment.
    private async Task SaveGuardingUniqueIndexAsync(string itemType, CancellationToken cancellationToken)
    {
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (ex is not DbUpdateConcurrencyException)
        {
            throw new DuplicateActiveRatePolicyException(itemType);
        }
    }

    private static bool IsGeneralCollection(string itemType)
        => string.Equals(itemType.Trim(), JobPaymentCalculator.GeneralCollectionItemType, StringComparison.OrdinalIgnoreCase);

    private static RatePolicyLookupResponse Map(RatePolicy r) => new()
    {
        Id = r.Id, ItemType = r.ItemType, RatePerKg = r.RatePerKg, IsActive = r.IsActive, EffectiveFrom = r.EffectiveFrom
    };
}
