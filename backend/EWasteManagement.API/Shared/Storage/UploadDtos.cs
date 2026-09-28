using Microsoft.AspNetCore.Http;

namespace EWasteManagement.API.Shared.Storage;

public class UploadRequestDto
{
    public IFormFile? File { get; set; }
}

public class UploadResponse
{
    public string Url { get; set; } = string.Empty;
}
