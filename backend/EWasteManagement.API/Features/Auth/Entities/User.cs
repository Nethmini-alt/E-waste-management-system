namespace EWasteManagement.API.Features.Auth.Entities;

public class User
{
    public const string WorkerRole = "Worker";

    public Guid UserId { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string FullName { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public StaffType? StaffType { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // The role put in the JWT. Worker staff get their own role so every existing
    // [Authorize(Roles = "Staff,Admin")] check keeps meaning "management staff or admin".
    public string GetAccessRole()
        => Role == UserRole.Staff && StaffType == Entities.StaffType.Worker ? WorkerRole : Role.ToString();
}
