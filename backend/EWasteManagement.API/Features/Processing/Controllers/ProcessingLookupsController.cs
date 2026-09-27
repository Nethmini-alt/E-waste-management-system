using EWasteManagement.API.Features.Processing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Processing.Controllers;

// Reference data for the Processing screens' dropdowns (receive forms, filters).
[ApiController]
[Route("api/v1/inventory/lookups")]
[Authorize(Roles = "Staff,Admin")]
public class ProcessingLookupsController : ControllerBase
{
    private readonly IProcessingLookupService _service;
    private readonly IItemTypeCatalogService _itemTypes;

    public ProcessingLookupsController(IProcessingLookupService service, IItemTypeCatalogService itemTypes)
    {
        _service = service;
        _itemTypes = itemTypes;
    }

    [HttpGet("warehouse-locations")]
    public async Task<IActionResult> GetWarehouseLocations(CancellationToken cancellationToken)
        => Ok(await _service.GetWarehouseLocationsAsync(cancellationToken));

    // Active policies by default — the receive form should only offer item types that can actually be paid.
    [HttpGet("rate-policies")]
    public async Task<IActionResult> GetRatePolicies([FromQuery] bool activeOnly = true, CancellationToken cancellationToken = default)
        => Ok(await _service.GetRatePoliciesAsync(activeOnly, cancellationToken));

    // The types a job item or a dismantled component may be given: active rate-policy types plus
    // Component D's priced material types. Plain strings, sorted by name.
    [HttpGet("item-types")]
    public async Task<IActionResult> GetItemTypes(CancellationToken cancellationToken)
        => Ok(await _itemTypes.GetAllowedTypesAsync(cancellationToken));

    [HttpGet("collectors")]
    public async Task<IActionResult> GetCollectors(CancellationToken cancellationToken)
        => Ok(await _service.GetCollectorsAsync(cancellationToken));
}
