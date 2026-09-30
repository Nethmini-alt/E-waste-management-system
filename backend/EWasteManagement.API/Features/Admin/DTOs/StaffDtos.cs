using EWasteManagement.API.Features.Auth.Entities;
using FluentValidation;

namespace EWasteManagement.API.Features.Admin.DTOs;

public class CreateStaffRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string Password { get; set; } = string.Empty;
    public StaffType StaffType { get; set; }
}

public class CreateStaffRequestValidator : AbstractValidator<CreateStaffRequest>
{
    public CreateStaffRequestValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(150);
        RuleFor(x => x.Email).NotEmpty().EmailAddress().MaximumLength(255);
        RuleFor(x => x.Phone).MaximumLength(20);
        RuleFor(x => x.Password).NotEmpty().MinimumLength(6).MaximumLength(100);
        RuleFor(x => x.StaffType).IsInEnum();
    }
}

public class StaffMemberResponse
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string StaffType { get; set; } = string.Empty;
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class StaffActivitySummaryResponse
{
    public Guid UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string StaffType { get; set; } = string.Empty;
    public bool IsDeleted { get; set; }

    public int ItemsReceived { get; set; }
    public int ExtraWasteReceipts { get; set; }
    public int DismantleSteps { get; set; }
    public int Classifications { get; set; }
    public int LocationMoves { get; set; }
    public int TotalInventoryActions { get; set; }

    public int PaymentsRaised { get; set; }
    public int PaymentsPaid { get; set; }
    public decimal AmountPaid { get; set; }

    public DateTime? LastActivityAt { get; set; }
}

public class StaffActivityEntryResponse
{
    public DateTime PerformedAt { get; set; }
    public string Action { get; set; } = string.Empty;
    public Guid InventoryItemId { get; set; }
    public string? ItemType { get; set; }
    public string? Notes { get; set; }
}
