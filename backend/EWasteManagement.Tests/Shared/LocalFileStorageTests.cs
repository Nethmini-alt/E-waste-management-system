using EWasteManagement.API.Shared.Storage;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Xunit;

namespace EWasteManagement.Tests.Shared;

public class LocalFileStorageTests : IDisposable
{
    private readonly string _contentRoot = Path.Combine(Path.GetTempPath(), "ewaste-upload-tests-" + Guid.NewGuid());

    public void Dispose()
    {
        if (Directory.Exists(_contentRoot)) Directory.Delete(_contentRoot, recursive: true);
    }

    private LocalFileStorage CreateStorage(string? publicBaseUrl = "https://uploads.example.test") =>
        new(
            new FakeEnvironment { ContentRootPath = _contentRoot, WebRootPath = Path.Combine(_contentRoot, "wwwroot") },
            new ConfigurationBuilder()
                .AddInMemoryCollection(new Dictionary<string, string?> { ["Storage:PublicBaseUrl"] = publicBaseUrl })
                .Build());

    private static FormFile MakeFile(byte[] content, string fileName) =>
        new(new MemoryStream(content), 0, content.Length, "file", fileName) { Headers = new HeaderDictionary(), ContentType = "image/jpeg" };

    [Fact]
    public async Task SaveAsync_writes_the_file_and_returns_a_url_under_the_configured_base()
    {
        var storage = CreateStorage("https://uploads.example.test");
        var bytes = new byte[] { 1, 2, 3, 4 };

        var url = await storage.SaveAsync(MakeFile(bytes, "photo.jpg"));

        Assert.StartsWith("https://uploads.example.test/uploads/", url);
        Assert.EndsWith(".jpg", url);

        var savedPath = Path.Combine(_contentRoot, "wwwroot", "uploads", Path.GetFileName(url));
        Assert.True(File.Exists(savedPath));
        Assert.Equal(bytes, await File.ReadAllBytesAsync(savedPath));
    }

    [Fact]
    public async Task SaveAsync_keeps_the_original_extension_but_replaces_the_filename()
    {
        var storage = CreateStorage();

        var pngUrl = await storage.SaveAsync(MakeFile(new byte[] { 1 }, "my photo.PNG"));
        var jpgUrl = await storage.SaveAsync(MakeFile(new byte[] { 1 }, "../../etc/passwd.jpg"));

        Assert.EndsWith(".PNG", pngUrl);
        Assert.DoesNotContain("my photo", pngUrl);
        Assert.DoesNotContain("..", jpgUrl);
        Assert.DoesNotContain("passwd", jpgUrl);
    }

    [Fact]
    public async Task Two_uploads_with_the_same_original_filename_do_not_collide()
    {
        var storage = CreateStorage();

        var first = await storage.SaveAsync(MakeFile(new byte[] { 1 }, "photo.jpg"));
        var second = await storage.SaveAsync(MakeFile(new byte[] { 2 }, "photo.jpg"));

        Assert.NotEqual(first, second);
        Assert.Equal(new byte[] { 1 }, await File.ReadAllBytesAsync(LocalPath(first)));
        Assert.Equal(new byte[] { 2 }, await File.ReadAllBytesAsync(LocalPath(second)));

        string LocalPath(string url) => Path.Combine(_contentRoot, "wwwroot", "uploads", Path.GetFileName(url));
    }

    // The strongest version of "built from config, not the request": SaveAsync
    // doesn't take an HttpContext or request at all, so it has nothing to
    // derive a URL from except the configured base — there's no request to
    // read a Host header from in the first place.
    [Theory]
    [InlineData("http://localhost:5172")]
    [InlineData("https://api.example.com")]
    [InlineData("http://10.0.2.2:5172")] // the Flutter Android emulator's own loopback alias
    public async Task Returned_url_always_starts_with_the_configured_public_base_url(string configuredBaseUrl)
    {
        var storage = CreateStorage(configuredBaseUrl);

        var url = await storage.SaveAsync(MakeFile(new byte[] { 1 }, "photo.jpg"));

        Assert.StartsWith(configuredBaseUrl + "/uploads/", url);
    }

    [Fact]
    public async Task A_trailing_slash_on_the_configured_base_url_does_not_produce_a_double_slash()
    {
        var storage = CreateStorage("https://uploads.example.test/");

        var url = await storage.SaveAsync(MakeFile(new byte[] { 1 }, "photo.jpg"));

        Assert.StartsWith("https://uploads.example.test/uploads/", url);
        Assert.DoesNotContain("test//uploads", url);
    }

    [Fact]
    public async Task Falls_back_to_localhost_5172_when_no_base_url_is_configured()
    {
        var storage = CreateStorage(publicBaseUrl: null);

        var url = await storage.SaveAsync(MakeFile(new byte[] { 1 }, "photo.jpg"));

        Assert.StartsWith("http://localhost:5172/uploads/", url);
    }

    private sealed class FakeEnvironment : IWebHostEnvironment
    {
        public string EnvironmentName { get; set; } = "Development";
        public string ApplicationName { get; set; } = "Tests";
        public string WebRootPath { get; set; } = string.Empty;
        public IFileProvider WebRootFileProvider { get; set; } = new NullFileProvider();
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
