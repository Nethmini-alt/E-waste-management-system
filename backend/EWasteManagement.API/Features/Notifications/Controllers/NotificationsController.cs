using System.Security.Claims;
using EWasteManagement.API.Features.Notifications.DTOs;
using EWasteManagement.API.Features.Notifications.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EWasteManagement.API.Features.Notifications.Controllers;

/// <summary>
/// The logged-in user's in-app notifications behind the header bell icon.
/// Every endpoint is scoped to the caller's token — there is no way to read
/// or clear another user's notifications.
/// </summary>
[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController : ControllerBase
{
    private readonly INotificationService _service;

    public NotificationsController(INotificationService service) => _service = service;

    /// <summary>Newest first; <paramref name="limit"/> clamps to 1–50.</summary>
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<NotificationResponse>>> GetMine(
        [FromQuery] int limit = 30, CancellationToken ct = default)
        => Ok(await _service.GetForUserAsync(CurrentUserId, limit, ct));

    [HttpGet("unread-count")]
    public async Task<ActionResult<UnreadCountResponse>> GetUnreadCount(CancellationToken ct)
        => Ok(new UnreadCountResponse { Count = await _service.GetUnreadCountAsync(CurrentUserId, ct) });

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkAsRead(Guid id, CancellationToken ct)
    {
        // Unknown id and someone else's id both answer 404, so ids of other
        // users' notifications cannot be probed.
        var found = await _service.MarkAsReadAsync(CurrentUserId, id, ct);
        return found ? NoContent() : NotFound();
    }

    [HttpPost("read-all")]
    public async Task<ActionResult<UnreadCountResponse>> MarkAllAsRead(CancellationToken ct)
    {
        await _service.MarkAllAsReadAsync(CurrentUserId, ct);
        return Ok(new UnreadCountResponse { Count = 0 });
    }

    private Guid CurrentUserId =>
        Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub")
            ?? throw new UnauthorizedAccessException("Token is missing a user id claim."));
}