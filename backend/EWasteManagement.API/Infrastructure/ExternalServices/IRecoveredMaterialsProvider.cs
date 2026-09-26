using EWasteManagement.API.Features.Sales.DTOs;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

/// <summary>
/// Boundary interface between Component D and Component C.
/// Component D never talks to C's storage directly — it always goes through this interface.
///
/// Current implementation: EfRecoveredMaterialsProvider, backed by processing inventory.
/// </summary>
public interface IRecoveredMaterialsProvider
{
    /// <summary>Get all recovered materials currently tracked by Component C.</summary>
    Task<IReadOnlyList<RecoveredMaterialResponse>> GetAllAsync(CancellationToken ct = default);

    /// <summary>Get only materials that are "Ready" and safety-validated — i.e. sellable.</summary>
    Task<IReadOnlyList<RecoveredMaterialResponse>> GetAvailableAsync(CancellationToken ct = default);

    /// <summary>Get one batch by id, or null if not found.</summary>
    Task<RecoveredMaterialResponse?> GetByIdAsync(Guid id, CancellationToken ct = default);
}