using CloudinaryDotNet;
using CloudinaryDotNet.Actions;

namespace EWasteManagement.API.Shared.Storage;

// Used only when Storage:Provider = "Cloudinary" (deployed environment).
// Uploads the image to Cloudinary and returns its public HTTPS URL.
public class CloudinaryFileStorage : IFileStorage
{
    private readonly Cloudinary _cloudinary;
    private readonly string _folder;

    public CloudinaryFileStorage(IConfiguration config)
    {
        var cloudName = config["Cloudinary:CloudName"];
        var apiKey    = config["Cloudinary:ApiKey"];
        var apiSecret = config["Cloudinary:ApiSecret"];

        if (string.IsNullOrWhiteSpace(cloudName) ||
            string.IsNullOrWhiteSpace(apiKey) ||
            string.IsNullOrWhiteSpace(apiSecret))
        {
            throw new InvalidOperationException(
                "Cloudinary storage is enabled but Cloudinary:CloudName/ApiKey/ApiSecret are not all set.");
        }

        _cloudinary = new Cloudinary(new Account(cloudName, apiKey, apiSecret));
        _cloudinary.Api.Secure = true;
        _folder = config["Cloudinary:Folder"] ?? "ewaste/uploads";
    }

    public async Task<string> SaveAsync(IFormFile file, CancellationToken ct = default)
    {
        await using var stream = file.OpenReadStream();

        var result = await _cloudinary.UploadAsync(new ImageUploadParams
        {
            File = new FileDescription(file.FileName, stream),
            PublicId = Guid.NewGuid().ToString("N"),   // random name, same idea as LocalFileStorage
            Folder = _folder,
            Overwrite = false
        }, ct);

        if (result.Error is not null)
            throw new InvalidOperationException($"Cloudinary upload failed: {result.Error.Message}");

        return result.SecureUrl.ToString();
    }
}