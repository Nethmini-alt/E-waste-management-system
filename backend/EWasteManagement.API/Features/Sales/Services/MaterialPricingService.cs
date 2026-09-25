using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Features.Sales.Exceptions;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Services;

public interface IMaterialPricingService
{
    Task<IReadOnlyList<MaterialPricingResponse>> GetAllAsync(
        MaterialPricingFilter filter, CancellationToken ct = default);

    Task<MaterialPricingResponse> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<MaterialPricingResponse> CreateAsync(
        CreateMaterialPricingRequest request, Guid currentUserId, CancellationToken ct = default);

    Task<MaterialPricingResponse> UpdateAsync(
        Guid id, UpdateMaterialPricingRequest request, CancellationToken ct = default);

    Task DeleteAsync(Guid id, CancellationToken ct = default);

    /// <summary>
    /// Flips Approved rows whose expiry date has passed into Expired and returns how many
    /// were updated. Correctness does not depend on this running — every pricing lookup
    /// already ignores expired-by-date rows — it keeps the stored Status honest for staff
    /// screens and reports. Called by the background sweeper and the manual endpoint.
    /// </summary>
    Task<int> ExpireStaleAsync(CancellationToken ct = default);
}

public class MaterialPricingService : IMaterialPricingService
{
    private readonly ApplicationDbContext _db;

    public MaterialPricingService(ApplicationDbContext db) => _db = db;

    // ---------- Reads ----------

    public async Task<IReadOnlyList<MaterialPricingResponse>> GetAllAsync(
        MaterialPricingFilter filter, CancellationToken ct = default)
    {
        var q = _db.MaterialPricings.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.MaterialType))
            q = q.Where(p => p.MaterialType == filter.MaterialType);

        if (!string.IsNullOrWhiteSpace(filter.Status)
            && Enum.TryParse<PricingStatus>(filter.Status, true, out var status))
        {
            q = q.Where(p => p.Status == status);
        }

        // Rows come back exactly as stored. A row can still read "Approved" for a few
        // hours after its expiry date until the sweeper runs, so each response carries
        // IsLive — the truthful "may this be used for pricing right now?" flag.
        var today = MaterialPricingPolicy.Today;
        return await q
            .OrderByDescending(p => p.EffectiveDate)
            .Select(p => Map(p, today))
            .ToListAsync(ct);
    }

    public async Task<MaterialPricingResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var row = await _db.MaterialPricings.AsNoTracking()
            .Include(p => p.CreatedBy)
            .FirstOrDefaultAsync(p => p.PricingId == id, ct)
            ?? throw new KeyNotFoundException($"Pricing {id} not found.");
        return Map(row, MaterialPricingPolicy.Today);
    }

    // ---------- Writes ----------

    public async Task<MaterialPricingResponse> CreateAsync(
        CreateMaterialPricingRequest request, Guid currentUserId, CancellationToken ct = default)
    {
        var material = request.MaterialType.Trim();

        // Business rule: prevent duplicate (material + effective date) row
        var dupe = await _db.MaterialPricings.AnyAsync(
            p => p.MaterialType == material && p.EffectiveDate == request.EffectiveDate, ct);
        if (dupe)
            throw new InvalidOperationException(
                $"A pricing row already exists for '{material}' effective {request.EffectiveDate:yyyy-MM-dd}.");

        var entity = new MaterialPricing
        {
            MaterialType = material,
            PricePerKg = request.PricePerKg,
            EffectiveDate = request.EffectiveDate,
            ExpiryDate = request.ExpiryDate,
            Status = PricingStatus.Draft,
            CreatedByUserId = currentUserId
        };

        _db.MaterialPricings.Add(entity);

        // The unique index on (material_type, effective_date) is the real gate; the check
        // above is just a friendly fast path. Translate a lost race into the same message.
        try
        {
            await _db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            throw new InvalidOperationException(
                $"A pricing row already exists for '{material}' effective {request.EffectiveDate:yyyy-MM-dd}.");
        }

        return await GetByIdAsync(entity.PricingId, ct);
    }

    public async Task<MaterialPricingResponse> UpdateAsync(
        Guid id, UpdateMaterialPricingRequest request, CancellationToken ct = default)
    {
        var entity = await _db.MaterialPricings.FirstOrDefaultAsync(p => p.PricingId == id, ct)
            ?? throw new KeyNotFoundException($"Pricing {id} not found.");

        var requestedStatus = Enum.Parse<PricingStatus>(request.Status, true);
        var material = request.MaterialType.Trim();
        var now = DateTime.UtcNow;

        // Approving a price that has already expired would be dead on arrival — it could
        // never price an order. Rejected here rather than in FluentValidation so the caller
        // sees this wording instead of a generic "one or more validation errors occurred".
        if (requestedStatus == PricingStatus.Approved
            && request.ExpiryDate is { } expiry
            && expiry <= MaterialPricingPolicy.Today)
        {
            throw new InvalidOperationException(
                $"Expiry date {expiry:yyyy-MM-dd} has already passed, so this price cannot be approved. " +
                "Set a future expiry date, or clear it (null means 'until replaced').");
        }

        // Business rule: only one Approved price per material type. The comparison uses the
        // material type being SAVED rather than the stored one, so renaming a row and
        // approving it in the same request still supersedes the previous approved price —
        // otherwise the new name would end up with two approved rows.
        var superseded = new List<MaterialPricing>();
        if (requestedStatus == PricingStatus.Approved)
        {
            superseded = await _db.MaterialPricings
                .Where(p => p.MaterialType == material
                            && p.Status == PricingStatus.Approved
                            && p.PricingId != entity.PricingId)
                .ToListAsync(ct);

            foreach (var old in superseded)
            {
                old.Status = PricingStatus.Expired;
                // If ExpiryDate wasn't set, stamp it with the new price's effective date
                old.ExpiryDate ??= request.EffectiveDate;
                old.UpdatedAt = now;
            }
        }

        // One transaction, but TWO save batches, and the superseded rows go first: EF is free
        // to emit the two UPDATEs in either order inside a single batch, which would briefly
        // leave two approved rows for the material and trip the partial unique index
        // IX_material_pricing_material_type_approved_unique.
        await using var tx = await _db.Database.BeginTransactionAsync(ct);
        try
        {
            if (superseded.Count > 0)
                await _db.SaveChangesAsync(ct);

            entity.MaterialType = material;
            entity.PricePerKg = request.PricePerKg;
            entity.EffectiveDate = request.EffectiveDate;
            entity.ExpiryDate = request.ExpiryDate;
            entity.Status = requestedStatus;
            entity.UpdatedAt = now;

            await _db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            await tx.RollbackAsync(ct);

            throw ViolatedApprovedIndex(ex)
                ? new DuplicateApprovedPricingException(material)
                : new InvalidOperationException(
                    $"A pricing row already exists for '{material}' effective {request.EffectiveDate:yyyy-MM-dd}.");
        }

        return await GetByIdAsync(entity.PricingId, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var entity = await _db.MaterialPricings.FirstOrDefaultAsync(p => p.PricingId == id, ct)
            ?? throw new KeyNotFoundException($"Pricing {id} not found.");

        // Business rule: only Draft rows can be deleted. Approved rows must be Expired instead.
        if (entity.Status == PricingStatus.Approved)
            throw new InvalidOperationException(
                "Approved pricing cannot be deleted. Mark it Expired instead.");

        _db.MaterialPricings.Remove(entity);
        await _db.SaveChangesAsync(ct);
    }

    // ---------- Housekeeping ----------

    public async Task<int> ExpireStaleAsync(CancellationToken ct = default)
    {
        var stale = await _db.MaterialPricings
            .WhereStale(MaterialPricingPolicy.Today)
            .ToListAsync(ct);

        if (stale.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var row in stale)
        {
            row.Status = PricingStatus.Expired;
            row.UpdatedAt = now;
        }

        await _db.SaveChangesAsync(ct);
        return stale.Count;
    }

    // ---------- Unique-index helpers ----------
    // material_pricing carries exactly two unique indexes:
    //   IX_material_pricing_material_type_effective_date    — one row per material per day
    //   IX_material_pricing_material_type_approved_unique   — partial: one approved row per material
    // Both PostgreSQL and SQLite name the violated index/constraint in the error text, so we
    // can pick the right domain message without referencing provider-specific exception types.

    private static bool IsUniqueViolation(DbUpdateException ex)
    {
        var message = ex.InnerException?.Message ?? ex.Message;
        return message.Contains("duplicate key", StringComparison.OrdinalIgnoreCase)
               || message.Contains("UNIQUE constraint failed", StringComparison.OrdinalIgnoreCase)
               || message.Contains("23505", StringComparison.Ordinal);
    }

    private static bool ViolatedApprovedIndex(DbUpdateException ex)
        => (ex.InnerException?.Message ?? ex.Message)
            .Contains("approved", StringComparison.OrdinalIgnoreCase);

    // ---------- Mapping ----------

    private static MaterialPricingResponse Map(MaterialPricing p, DateOnly today) => new()
    {
        PricingId = p.PricingId,
        MaterialType = p.MaterialType,
        PricePerKg = p.PricePerKg,
        EffectiveDate = p.EffectiveDate,
        ExpiryDate = p.ExpiryDate,
        Status = p.Status.ToString(),
        IsLive = MaterialPricingPolicy.IsLive(p, today),
        CreatedByUserId = p.CreatedByUserId,
        CreatedByName = p.CreatedBy?.FullName ?? string.Empty,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}