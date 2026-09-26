using EWasteManagement.API.Features.Processing.DTOs;

namespace EWasteManagement.API.Features.Processing.Services;

/// <summary>
/// Admin management of the rates that price collector payments. A rate row is never edited: the only
/// change ever made to an existing row is switching it off. Revising or restoring a rate adds a new
/// row, so the table is an exact history of which rate applied from when. Past payments are unaffected
/// either way — each payment stores the rate it used in its calculation snapshot.
/// </summary>
public interface IRatePolicyService
{
    Task<RatePolicyLookupResponse> CreateAsync(CreateRatePolicyRequest request, CancellationToken cancellationToken = default);

    /// <summary>Switches the active rate off and adds a new active rate for the same item type.</summary>
    Task<RatePolicyLookupResponse> ReviseAsync(Guid id, ReviseRatePolicyRequest request, CancellationToken cancellationToken = default);

    /// <summary>Stops the item type being paid for as extra waste. "GeneralCollection" can never be deactivated.</summary>
    Task<RatePolicyLookupResponse> DeactivateAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Adds a new active rate copying an inactive row's rate, if its type has no active rate.</summary>
    Task<RatePolicyLookupResponse> RestoreAsync(Guid id, CancellationToken cancellationToken = default);
}
