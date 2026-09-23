using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
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

        return await q
            .OrderByDescending(p => p.EffectiveDate)
            .Select(p => Map(p))
            .ToListAsync(ct);
    }

    public async Task<MaterialPricingResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var row = await _db.MaterialPricings.AsNoTracking()
            .Include(p => p.CreatedBy)
            .FirstOrDefaultAsync(p => p.PricingId == id, ct)
            ?? throw new KeyNotFoundException($"Pricing {id} not found.");
        return Map(row);
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
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(entity.PricingId, ct);
    }

    public async Task<MaterialPricingResponse> UpdateAsync(
        Guid id, UpdateMaterialPricingRequest request, CancellationToken ct = default)
    {
        var entity = await _db.MaterialPricings.FirstOrDefaultAsync(p => p.PricingId == id, ct)
            ?? throw new KeyNotFoundException($"Pricing {id} not found.");

        var requestedStatus = Enum.Parse<PricingStatus>(request.Status, true);

        // Business rule: when approving, expire any currently approved price for the same material
        if (requestedStatus == PricingStatus.Approved && entity.Status != PricingStatus.Approved)
        {
            var currentApproved = await _db.MaterialPricings
                .Where(p => p.MaterialType == entity.MaterialType
                            && p.Status == PricingStatus.Approved
                            && p.PricingId != entity.PricingId)
                .ToListAsync(ct);

            foreach (var old in currentApproved)
            {
                old.Status = PricingStatus.Expired;
                // If ExpiryDate wasn't set, stamp it with the new price's effective date
                old.ExpiryDate ??= request.EffectiveDate;
                old.UpdatedAt = DateTime.UtcNow;
            }
        }

        entity.MaterialType = request.MaterialType.Trim();
        entity.PricePerKg = request.PricePerKg;
        entity.EffectiveDate = request.EffectiveDate;
        entity.ExpiryDate = request.ExpiryDate;
        entity.Status = requestedStatus;
        entity.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
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

    // ---------- Mapping ----------

    private static MaterialPricingResponse Map(MaterialPricing p) => new()
    {
        PricingId = p.PricingId,
        MaterialType = p.MaterialType,
        PricePerKg = p.PricePerKg,
        EffectiveDate = p.EffectiveDate,
        ExpiryDate = p.ExpiryDate,
        Status = p.Status.ToString(),
        CreatedByUserId = p.CreatedByUserId,
        CreatedByName = p.CreatedBy?.FullName ?? string.Empty,
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt
    };
}