using Microsoft.AspNetCore.Http;

namespace EWasteManagement.API.Shared.Storage;

/// <summary>
/// Saves an uploaded file somewhere durable and returns a URL it can be
/// downloaded back from — by anyone, without authentication, since the
/// Analyzer agent has no login token of its own (see UploadsController and
/// Program.cs's UseStaticFiles() call). LocalFileStorage is the only
/// implementation today; a cloud-storage one could replace it later without
/// touching any caller.
/// </summary>
public interface IFileStorage
{
    Task<string> SaveAsync(IFormFile file, CancellationToken ct = default);
}
