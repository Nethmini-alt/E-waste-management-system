using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Features.Notifications.DTOs;
using EWasteManagement.API.Features.Notifications.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Notifications.Services;

public interface INotificationService
{
    /// <summary>Store one notification for one user (fire-and-forget friendly: never throws for a missing user).</summary>
    Task NotifyAsync(
        Guid userId,
        string title,
        string message,
        NotificationType type = NotificationType.Info,
        string? link = null,
        CancellationToken ct = default);

    /// <summary>Store the same notification for every active, non-deleted user holding one of the given roles.</summary>
    Task NotifyRolesAsync(
        IEnumerable<UserRole> roles,
        string title,
        string message,
        NotificationType type = NotificationType.Info,
        string? link = null,
        CancellationToken ct = default);

    /// <summary>The recipient's most recent notifications, newest first.</summary>
    Task<IReadOnlyList<NotificationResponse>> GetForUserAsync(Guid userId, int limit = 30, CancellationToken ct = default);

    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken ct = default);

    /// <summary>Returns false when the notification does not exist or belongs to someone else.</summary>
    Task<bool> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken ct = default);

    /// <summary>Number of rows flipped from unread to read.</summary>
    Task<int> MarkAllAsReadAsync(Guid userId, CancellationToken ct = default);
}

/// <summary>
/// In-app notifications for the header bell. Writes go through the shared
/// DbContext so a notification commits with whatever produced it; every read
/// is filtered by the caller's user id so one user can never see another's rows.
/// </summary>
public class NotificationService : INotificationService
{
    private const int MaxLimit = 50;

    private readonly ApplicationDbContext _db;

    public NotificationService(ApplicationDbContext db) => _db = db;

    public async Task NotifyAsync(
        Guid userId,
        string title,
        string message,
        NotificationType type = NotificationType.Info,
        string? link = null,
        CancellationToken ct = default)
    {
        // A notification is never worth failing the operation that produced it
        // (e.g. a submission whose owner account row is gone).
        if (!await UserExistsAsync(userId, ct)) return;

        _db.Notifications.Add(New(userId, title, message, type, link));
        await _db.SaveChangesAsync(ct);
    }

    public async Task NotifyRolesAsync(
        IEnumerable<UserRole> roles,
        string title,
        string message,
        NotificationType type = NotificationType.Info,
        string? link = null,
        CancellationToken ct = default)
    {
        // Comparing the enum directly lets EF apply the column's value
        // converter (stored lowercase) instead of guessing at ToString().
        var roleList = roles.Distinct().ToList();
        var userIds = await _db.Users
            .Where(u => u.IsActive && roleList.Contains(u.Role))
            .Select(u => u.UserId)
            .ToListAsync(ct);

        if (userIds.Count == 0) return;

        _db.Notifications.AddRange(userIds.Select(id => New(id, title, message, type, link)));
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<NotificationResponse>> GetForUserAsync(
        Guid userId, int limit = 30, CancellationToken ct = default)
    {
        var capped = Math.Clamp(limit, 1, MaxLimit);
        var rows = await _db.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(capped)
            .ToListAsync(ct);

        return rows.Select(NotificationResponse.From).ToList();
    }

    public Task<int> GetUnreadCountAsync(Guid userId, CancellationToken ct = default) =>
        _db.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead, ct);

    public async Task<bool> MarkAsReadAsync(Guid userId, Guid notificationId, CancellationToken ct = default)
    {
        var row = await _db.Notifications
            .FirstOrDefaultAsync(n => n.Id == notificationId && n.UserId == userId, ct);
        if (row is null) return false;
        if (row.IsRead) return true;

        row.IsRead = true;
        row.ReadAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<int> MarkAllAsReadAsync(Guid userId, CancellationToken ct = default)
    {
        var rows = await _db.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync(ct);
        if (rows.Count == 0) return 0;

        var now = DateTime.UtcNow;
        foreach (var row in rows)
        {
            row.IsRead = true;
            row.ReadAt = now;
        }
        await _db.SaveChangesAsync(ct);
        return rows.Count;
    }

    private static Notification New(Guid userId, string title, string message, NotificationType type, string? link) =>
        new()
        {
            UserId = userId,
            Title = title.Trim(),
            Message = message.Trim(),
            Type = type,
            Link = link,
        };

    // Users have a global soft-delete query filter; matching on the raw flag
    // instead keeps this working even if a caller maps without the filter.
    private Task<bool> UserExistsAsync(Guid userId, CancellationToken ct) =>
        _db.Users.AnyAsync(u => u.UserId == userId && !u.IsDeleted, ct);
}