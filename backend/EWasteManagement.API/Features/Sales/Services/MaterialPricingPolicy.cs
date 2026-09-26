using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Services;

/// <summary>
/// Single source of truth for the question "may this price be used right now?".
///
/// A row is LIVE when it is <see cref="PricingStatus.Approved"/> AND its expiry window
/// has not passed (<c>ExpiryDate == null</c> means "until replaced").
///
/// Everything that turns a material into money — local sales orders, export orders and
/// the AI agent's pricing tool — must filter through here so that a row whose expiry
/// date has passed can never price a new order, even in the window before the
/// background sweeper flips its Status to Expired.
/// </summary>
public static class MaterialPricingPolicy
{
    /// <summary>
    /// "Today" for pricing decisions, in UTC. Pricing dates are <see cref="DateOnly"/>,
    /// so a plain date comparison is both correct and index-friendly.
    /// </summary>
    public static DateOnly Today => DateOnly.FromDateTime(DateTime.UtcNow);

    /// <summary>In-memory twin of <see cref="WhereLive"/> — used when mapping responses.</summary>
    public static bool IsLive(MaterialPricing pricing, DateOnly asOf)
        => pricing.Status == PricingStatus.Approved
           && (pricing.ExpiryDate is null || pricing.ExpiryDate > asOf);

    /// <summary>Approved rows that are still inside their expiry window as of <paramref name="asOf"/>.</summary>
    public static IQueryable<MaterialPricing> WhereLive(this IQueryable<MaterialPricing> query, DateOnly asOf)
        => query.Where(p => p.Status == PricingStatus.Approved
                            && (p.ExpiryDate == null || p.ExpiryDate > asOf));

    /// <summary>
    /// Still Approved but past its expiry date — the sweeper's work list. These rows are
    /// deliberately NOT live: <see cref="WhereLive"/> already excludes them by date.
    /// </summary>
    public static IQueryable<MaterialPricing> WhereStale(this IQueryable<MaterialPricing> query, DateOnly asOf)
        => query.Where(p => p.Status == PricingStatus.Approved
                            && p.ExpiryDate != null
                            && p.ExpiryDate <= asOf);

    /// <summary>
    /// The price a new order line for <paramref name="materialType"/> must be priced at:
    /// the live row with the most recent effective date (ties broken by most recently created).
    /// Returns null when the material has no usable price, so callers decide the message.
    /// </summary>
    public static Task<MaterialPricing?> CurrentForAsync(
        this IQueryable<MaterialPricing> query, string materialType, DateOnly asOf, CancellationToken ct = default)
        => query.WhereLive(asOf)
            .Where(p => p.MaterialType == materialType)
            .OrderByDescending(p => p.EffectiveDate)
            .ThenByDescending(p => p.CreatedAt)
            .FirstOrDefaultAsync(ct);
}
