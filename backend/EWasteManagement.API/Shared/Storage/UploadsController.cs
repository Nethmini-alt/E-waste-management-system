using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Shared.Storage;

// One shared upload endpoint for every feature that needs an image URL —
// today the Submission item form, and later Collection's completion-photo
// flow — rather than each feature building its own. Any logged-in user may
// call it; the file itself carries no ownership, so there's nothing here to
// restrict by role.
[ApiController]
[Route("api/v1/uploads")]
[Authorize]
public class UploadsController : ControllerBase
{
    private readonly IFileStorage _storage;

    public UploadsController(IFileStorage storage)
    {
        _storage = storage;
    }

    [HttpPost]
    [Consumes("multipart/form-data")]
    public async Task<ActionResult<UploadResponse>> Upload([FromForm] UploadRequestDto request, CancellationToken ct)
    {
        var url = await _storage.SaveAsync(request.File!, ct);
        return Ok(new UploadResponse { Url = url });
    }
}
