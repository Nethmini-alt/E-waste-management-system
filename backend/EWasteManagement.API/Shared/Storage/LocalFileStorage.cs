namespace EWasteManagement.API.Shared.Storage;

// Saves uploaded files to disk under wwwroot/uploads (served back out by
// UseStaticFiles() in Program.cs, unauthenticated on purpose) and returns a
// URL built from the configured "Storage:PublicBaseUrl" — never from the
// incoming request's Host header. A request-derived URL only makes sense
// from that one caller's point of view: behind Docker, behind a reverse
// proxy, or from the Flutter emulator (whose own loopback alias, 10.0.2.2,
// nobody else can reach), the Host header isn't an address other clients —
// including the Analyzer agent, which downloads this URL over plain HTTP —
// can actually use to fetch the file back.
public class LocalFileStorage : IFileStorage
{
    private readonly string _uploadsPath;
    private readonly string _publicBaseUrl;

    public LocalFileStorage(IWebHostEnvironment env, IConfiguration config)
    {
        var webRoot = string.IsNullOrEmpty(env.WebRootPath)
            ? Path.Combine(env.ContentRootPath, "wwwroot")
            : env.WebRootPath;
        _uploadsPath = Path.Combine(webRoot, "uploads");
        Directory.CreateDirectory(_uploadsPath);

        _publicBaseUrl = (config["Storage:PublicBaseUrl"] ?? "http://localhost:5172").TrimEnd('/');
    }

    public async Task<string> SaveAsync(IFormFile file, CancellationToken ct = default)
    {
        // A random name, not the caller's original filename — avoids both
        // collisions between unrelated uploads and path-traversal tricks
        // hiding in a crafted filename. Only the extension is kept.
        var extension = Path.GetExtension(file.FileName);
        var fileName = $"{Guid.NewGuid():N}{extension}";
        var filePath = Path.Combine(_uploadsPath, fileName);

        await using (var output = File.Create(filePath))
        {
            await file.CopyToAsync(output, ct);
        }

        return $"{_publicBaseUrl}/uploads/{fileName}";
    }
}
