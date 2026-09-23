using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Services;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Controllers;

/// <summary>
/// Read-only surface for the AI agent. Authenticated by X-Agent-Key header
/// instead of JWT. All endpoints here are safe-to-read; no mutations.
/// </summary>
[ApiController]
[Route("api/agent")]
[AllowAnonymous]
public class AgentController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly IRecoveredMaterialsProvider _materials;
    private readonly ApplicationDbContext _db;

    public AgentController(
        IConfiguration config,
        IRecoveredMaterialsProvider materials,
        EWasteManagement.API.Infrastructure.Persistence.ApplicationDbContext db)
    {
        _config = config;
        _materials = materials;
        _db = db;
    }

    // ---- Auth helper ----
    private bool IsAuthorized()
    {
        var expected = _config["Agent:ApiKey"];
        if (string.IsNullOrWhiteSpace(expected)) return false;
        if (!Request.Headers.TryGetValue("X-Agent-Key", out var provided)) return false;
        return provided == expected;
    }

    private IActionResult? Guard() =>
        IsAuthorized() ? null : Unauthorized(new { message = "Invalid agent API key." });

    // ---- Tools exposed to the agent ----

    /// <summary>getAvailableRecoveredMaterials — sellable batches only.</summary>
    [HttpGet("materials/available")]
    public async Task<IActionResult> GetAvailableMaterials(CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        var data = await _materials.GetAvailableAsync(ct);
        return Ok(data);
    }

    /// <summary>getCurrentMaterialPricing — only Approved prices.</summary>
    [HttpGet("pricing/approved")]
    public async Task<IActionResult> GetApprovedPricing(CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        var data = await _db.MaterialPricings
            .AsNoTracking()
            .Where(p => p.Status == Features.Sales.Entities.PricingStatus.Approved)
            .OrderByDescending(p => p.EffectiveDate)
            .Select(p => new
            {
                materialType = p.MaterialType,
                pricePerKg = p.PricePerKg,
                effectiveDate = p.EffectiveDate
            })
            .ToListAsync(ct);

        return Ok(data);
    }

    /// <summary>getEligibleBuyers — Active buyers only, with contact + type.</summary>
    [HttpGet("buyers/eligible")]
    public async Task<IActionResult> GetEligibleBuyers(CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        var data = await _db.Buyers
            .AsNoTracking()
            .Where(b => b.Status == Features.Sales.Entities.BuyerStatus.Active)
            .Select(b => new
            {
                buyerId = b.BuyerId,
                companyName = b.CompanyName,
                contactPerson = b.ContactPerson,
                email = b.Email,
                buyerType = b.BuyerType.ToString()
            })
            .ToListAsync(ct);

        return Ok(data);
    }
    /// <summary>getBuyerOffers — placeholder until an Offers table exists.</summary>
    [HttpGet("buyers/{buyerId:guid}/offers")]
    public async Task<IActionResult> GetBuyerOffers(Guid buyerId, CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        // No offers table yet — return empty. Structure is stable so agent code
        // won't need to change when offers land.
        return Ok(Array.Empty<object>());
    }
}