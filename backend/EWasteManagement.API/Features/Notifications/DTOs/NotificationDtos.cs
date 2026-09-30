using EWasteManagement.API.Features.Notifications.Entities;

namespace EWasteManagement.API.Features.Notifications.DTOs;

public class NotificationResponse
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;

    /// <summary>Lowercase severity: "info" | "success" | "warning" | "error".</summary>
    public string Type { get; set; } = "info";

    public string? Link { get; set; }
    public bool IsRead { get; set; }
    public DateTime? ReadAt { get; set; }
    public DateTime CreatedAt { get; set; }

    public static NotificationResponse From(Notification n) => new()
    {
        Id = n.Id,
        Title = n.Title,
        Message = n.Message,
        Type = n.Type.ToString().ToLowerInvariant(),
        Link = n.Link,
        IsRead = n.IsRead,
        ReadAt = n.ReadAt,
        CreatedAt = n.CreatedAt,
    };
}

public class UnreadCountResponse
{
    public int Count { get; set; }
}