using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
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

    /// <summary>getCurrentMaterialPricing — only Approved prices that have not expired.</summary>
    [HttpGet("pricing/approved")]
    public async Task<IActionResult> GetApprovedPricing(CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        // Same rule the order services apply: Approved AND inside its expiry window, so the
        // agent never plans or prices against a dead rate.
        var data = await _db.MaterialPricings
            .AsNoTracking()
            .WhereLive(MaterialPricingPolicy.Today)
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
            .Where(b => b.Status == BuyerStatus.Active)
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

    /// <summary>
    /// getOpenMaterialRequests — the buyer demand competing for saleable stock: Waiting,
    /// WaitingForPrice and PlanGenerationFailed requests from Active buyers, with the
    /// live approved price for each material.
    ///
    /// This is what lets the Sales agent rank demand itself (POST /prioritize-demand)
    /// instead of the backend pre-ordering requests by expected net value for it.
    /// </summary>
    [HttpGet("material-requests/open")]
    public async Task<IActionResult> GetOpenMaterialRequests(
        [FromQuery] string? materialType, CancellationToken ct)
    {
        var guard = Guard();
        if (guard != null) return guard;

        // One live-price lookup for the whole page, using the same rule the order
        // services apply, so the agent never ranks against a dead rate.
        var prices = await _db.MaterialPricings
            .AsNoTracking()
            .WhereLive(MaterialPricingPolicy.Today)
            .OrderByDescending(p => p.EffectiveDate)
            .Select(p => new { p.MaterialType, p.PricePerKg })
            .ToListAsync(ct);

        var priceByType = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase);
        foreach (var price in prices)
            priceByType.TryAdd(price.MaterialType, price.PricePerKg);

        var query = _db.MaterialRequests
            .AsNoTracking()
            .Include(r => r.Buyer)
            .Where(r => (r.Status == MaterialRequestStatus.Waiting
                    || r.Status == MaterialRequestStatus.WaitingForPrice
                    || r.Status == MaterialRequestStatus.PlanGenerationFailed)
                && r.Buyer.Status == BuyerStatus.Active);

        if (!string.IsNullOrWhiteSpace(materialType))
        {
            var wanted = materialType.Trim().ToLower();
            query = query.Where(r => r.MaterialType.ToLower() == wanted);
        }

        // Oldest first: the agent's "fifo" objective and every table break rely on it.
        var requests = await query.OrderBy(r => r.CreatedAt).ToListAsync(ct);
        var now = DateTime.UtcNow;

        var data = requests.Select(r => new AgentOpenDemandDto
        {
            MaterialRequestId = r.MaterialRequestId,
            BuyerId = r.BuyerId,
            BuyerCompanyName = r.Buyer.CompanyName,
            BuyerType = r.Buyer.BuyerType.ToString(),
            MaterialType = r.MaterialType,
            QuantityKg = r.QuantityKg,
            Status = r.Status.ToString(),
            PricePerKg = priceByType.TryGetValue(r.MaterialType, out var price) ? price : (decimal?)null,
            WaitingHours = Math.Round((now - r.CreatedAt).TotalHours, 2),
            CreatedAt = r.CreatedAt
        }).ToList();

        return Ok(data);
    }
}