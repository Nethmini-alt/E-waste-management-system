namespace EWasteManagement.API.Features.Auth.DTOs;

public class AuthResponse
{
    public string Token { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;

    /// <summary>Same value as the JWT role claim: "Worker" for worker staff, "Staff" for management staff.</summary>
    public string Role { get; set; } = string.Empty;

    public string? StaffType { get; set; }
}
