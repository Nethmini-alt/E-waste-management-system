using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Notifications.Entities;

/// <summary>
/// An in-app notification for one user, shown in the web header's bell icon.
/// Rows are created by system events (submission received, workflow decided,
/// job needs attention, …) and never sent anywhere else — there is no email
/// or push channel today.
/// </summary>
public class Notification : BaseEntity
{
    /// <summary>FK to users.user_id — the recipient. Every user only ever reads their own rows.</summary>
    public Guid UserId { get; set; }

    public string Title { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    /// <summary>Severity shown by the bell dropdown: Info, Success, Warning or Error.</summary>
    public NotificationType Type { get; set; } = NotificationType.Info;

    /// <summary>Frontend route to open when the notification is clicked (e.g. "/collection/jobs/{id}").</summary>
    public string? Link { get; set; }

    public bool IsRead { get; set; }

    public DateTime? ReadAt { get; set; }

    /// <summary>Recipient's account — used for the role fan-out query and to keep deletes consistent.</summary>
    public User User { get; set; } = null!;
}

public enum NotificationType
{
    Info,
    Success,
    Warning,
    Error
}