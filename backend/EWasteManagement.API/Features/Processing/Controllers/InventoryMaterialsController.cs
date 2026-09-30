using EWasteManagement.API.Features.Processing.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Processing.Controllers;

[ApiController]
[Route("api/v1/inventory/recovered-materials")]
[Authorize(Roles = "Staff,Admin,Worker")]
public class InventoryMaterialsController : ControllerBase
{
    private readonly IRecoveredMaterialSummaryService _service;

    public InventoryMaterialsController(IRecoveredMaterialSummaryService service) => _service = service;

    // Sellable recovered materials grouped by material type, with each item and its location.
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
        => Ok(await _service.GetGroupsAsync(cancellationToken));
}
