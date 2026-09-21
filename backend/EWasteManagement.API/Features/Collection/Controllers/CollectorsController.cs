using System.Security.Claims;
using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Services;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Collection.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
[Authorize]
public class CollectorsController : ControllerBase
{
    private readonly ICollectorService _collectorService;
    private readonly IMatchingService _matchingService;
    private readonly IGeoService _geoService;

    public CollectorsController(
        ICollectorService collectorService,
        IMatchingService matchingService,
        IGeoService geoService)
    {
        _collectorService = collectorService;
        _matchingService = matchingService;
        _geoService = geoService;
    }

    // POST /api/v1/collectors
    // Creates the collector profile for whoever is logged in. UserId comes
    // from the JWT, never from the request body — otherwise anyone could
    // create a profile "for" another user.
    [HttpPost]
    [Authorize(Roles = "Collector")]
    public async Task<ActionResult<CollectorResponseDto>> CreateProfile(CreateCollectorProfileDto dto)
    {
        try
        {
            var result = await _collectorService.CreateProfileAsync(CurrentUserId, dto);
            return CreatedAtAction(nameof(GetMe), result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(new { message = ex.Message });
        }
    }

    // GET /api/v1/collectors/me
    // Convenience endpoint the Flutter app calls on startup to check
    // whether the logged-in collector already has a profile.
    [HttpGet("me")]
    [Authorize(Roles = "Collector")]
    public async Task<ActionResult<CollectorResponseDto>> GetMe()
    {
        var result = await _collectorService.GetByUserIdAsync(CurrentUserId);
        return result is null ? NotFound(new { message = "No collector profile exists for this user yet." }) : Ok(result);
    }

    // GET /api/v1/collectors/{id}
    // Staff/admin lookup — e.g. for the dashboard.
    [HttpGet("{id:guid}")]
    [Authorize(Roles = "Staff,Admin")]
    public async Task<ActionResult<CollectorResponseDto>> GetById(Guid id)
    {
        var result = await _collectorService.GetByIdAsync(id);
        return result is null ? NotFound() : Ok(result);
    }

    // PUT /api/v1/collectors/{id}/availability
    [HttpPut("{id:guid}/availability")]
    [Authorize(Roles = "Collector")]
    public async Task<ActionResult<CollectorResponseDto>> UpdateAvailability(Guid id, UpdateAvailabilityDto dto)
    {
        try
        {
            var result = await _collectorService.UpdateAvailabilityAsync(id, CurrentUserId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
    }

    // PUT /api/v1/collectors/{id}/location
    // Called periodically by the Flutter app while the collector is on shift.
    [HttpPut("{id:guid}/location")]
    [Authorize(Roles = "Collector")]
    public async Task<ActionResult<CollectorResponseDto>> UpdateLocation(Guid id, UpdateLocationDto dto)
    {
        try
        {
            var result = await _collectorService.UpdateLocationAsync(id, CurrentUserId, dto);
            return Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid(ex.Message);
        }
    }

    // The "sub" claim from JwtService carries the UserId, mapped by the
    // default inbound claim handler to ClaimTypes.NameIdentifier.
    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? throw new UnauthorizedAccessException("Token is missing a user id claim."));

    // GET /api/v1/collectors/available?pickupLatitude=&pickupLongitude=&...
    // Staff-facing: manual override / dashboard visibility into who would be matched.
    [HttpGet("available")]
    [Authorize(Roles = "Staff,Admin")]
    public async Task<ActionResult<List<CollectorMatchDto>>> GetAvailable([FromQuery] MatchRequestDto request)
    {
        var results = await _matchingService.FindCandidatesAsync(request);
        return Ok(results);
    }

    // POST /api/v1/collectors/match
    // The Matcher agent's find_collectors tool call. Machine-to-machine: it skips
    // the user JWT and is guarded by the agent key (X-Agent-Key) instead.
    [HttpPost("match")]
    [AllowAnonymous]
    [AgentKey]
    public async Task<ActionResult<List<CollectorMatchDto>>> Match(MatchRequestDto request)
    {
        var results = await _matchingService.FindCandidatesAsync(request);
        return Ok(results);
    }

    // POST /api/v1/collectors/geocode
    // The Matcher agent's geocode_address tool call: pickup address -> coordinates.
    // An address that can't be resolved is a normal 200 with resolved = false.
    [HttpPost("geocode")]
    [AllowAnonymous]
    [AgentKey]
    public async Task<ActionResult<GeocodeResponseDto>> Geocode(GeocodeRequestDto request)
    {
        var point = await _geoService.GeocodeAsync(request.Address.Trim());

        return Ok(point is { } p
            ? new GeocodeResponseDto { Resolved = true, Latitude = p.Latitude, Longitude = p.Longitude }
            : new GeocodeResponseDto { Resolved = false });
    }
}
