namespace EWasteManagement.API.Features.Sales.DTOs;

// ---------- Response ----------
public class BuyerResponse
{
    public Guid BuyerId { get; set; }
    public Guid UserId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string BuyerType { get; set; } = string.Empty;   // "Local" | "Export"
    public string Status { get; set; } = string.Empty;      // "Pending" | "Active" | "Suspended"
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

// ---------- Create ----------
public class CreateBuyerRequest
{
    public Guid UserId { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string BuyerType { get; set; } = "Local";        // "Local" | "Export"
}

// ---------- Update ----------
public class UpdateBuyerRequest
{
    public string CompanyName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }
    public string BuyerType { get; set; } = "Local";
    public string Status { get; set; } = "Pending";
}

public class AvailableUserResponse
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
}

public class RegisterBuyerRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string CompanyName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string BuyerType { get; set; } = "Local";
}