namespace EWasteManagement.API.Features.Processing.Services;

/// <summary>
/// The item types an inventory item may be given when it is received from a job or created by
/// dismantling: every active rate-policy type plus every material type Component D prices.
/// Keeping items on this list is what lets Sales price them later — Sales matches an item's
/// ItemType against MaterialPricing.MaterialType exactly.
/// </summary>
public interface IItemTypeCatalogService
{
    /// <summary>The allowed types, one spelling per type (case-insensitive), sorted by name.</summary>
    Task<IReadOnlyList<string>> GetAllowedTypesAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// The list's own spelling of <paramref name="itemType"/> (matched case-insensitively, ignoring
    /// surrounding spaces), or null when it is not on the list.
    /// </summary>
    Task<string?> ResolveAsync(string? itemType, CancellationToken cancellationToken = default);
}
