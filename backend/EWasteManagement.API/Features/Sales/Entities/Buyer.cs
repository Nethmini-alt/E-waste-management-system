using EWasteManagement.API.Features.Auth.Entities;
namespace EWasteManagement.API.Features.Sales.Entities;

/// <summary>
/// Commercial buyer profile. Linked 1-to-1 with a User whose role = Corporate.
/// Component D owns this table.
/// </summary>
public class Buyer
{
    public Guid BuyerId { get; set; } = Guid.NewGuid();

    /// <summary>FK to users.user_id. Every buyer is also a User with role=corporate.</summary>
    public Guid UserId { get; set; }

    public string CompanyName { get; set; } = string.Empty;
    public string ContactPerson { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? PhoneNumber { get; set; }
    public string? Address { get; set; }

    public BuyerType BuyerType { get; set; } = BuyerType.Local;
    public BuyerStatus Status { get; set; } = BuyerStatus.Pending;

    // Soft delete (matches your User pattern)
    public bool IsDeleted { get; set; } = false;
    public DateTime? DeletedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }

    // Navigation
    public User User { get; set; } = null!;
    //public ICollection<SalesOrder> SalesOrders { get; set; } = new List<SalesOrder>();
    //public ICollection<ExportOrder> ExportOrders { get; set; } = new List<ExportOrder>();
}

public enum BuyerType
{
    Local,
    Export
}

public enum BuyerStatus
{
    Pending,
    Active,
    Suspended
}