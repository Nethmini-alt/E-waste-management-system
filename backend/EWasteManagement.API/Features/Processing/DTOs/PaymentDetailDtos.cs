namespace EWasteManagement.API.Features.Processing.DTOs;

/// <summary>
/// One payment with everything needed to understand where its amount came from.
/// The amount and its breakdown come from the SAVED snapshot — nothing here is recalculated.
/// Only display fields are exposed (names, vehicle); no emails, phones or credentials.
/// </summary>
public class PaymentDetailResponse
{
    public Guid Id { get; set; }
    public string SourceType { get; set; } = string.Empty;
    public Guid SourceId { get; set; }
    public decimal Amount { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? PaidAt { get; set; }

    public Guid CollectorId { get; set; }
    public string? CollectorName { get; set; }
    public string? CollectorVehicleType { get; set; }

    // Null on payments created before audit tracking (for extra-waste payments the creator is
    // taken from the receipt, which was written in the same request).
    public Guid? CreatedByStaffId { get; set; }
    public string? CreatedByName { get; set; }
    public Guid? PaidByStaffId { get; set; }
    public string? PaidByName { get; set; }

    /// <summary>False for payments created before snapshots existed: no breakdown was saved and none is invented.</summary>
    public bool HasSnapshot { get; set; }
    public PaymentCalculationSnapshot? Snapshot { get; set; }

    public PaymentJobInfo? Job { get; set; }
    public PaymentReceiptInfo? Receipt { get; set; }
}

public class PaymentJobInfo
{
    public Guid JobId { get; set; }
    public DateTime? CompletedAt { get; set; }
    /// <summary>The inventory item created when this job was received.</summary>
    public Guid? InventoryItemId { get; set; }
}

public class PaymentReceiptInfo
{
    public Guid ReceiptId { get; set; }
    public DateTime ReceivedAt { get; set; }
    public string? Notes { get; set; }
    public string? ReceivedByName { get; set; }
    /// <summary>Live receipt lines (facts only — type, weight, accepted, reason). Rates come from the snapshot.</summary>
    public List<ReceiptItemInfo> Items { get; set; } = new();
}

public class ReceiptItemInfo
{
    public Guid Id { get; set; }
    public string ItemType { get; set; } = string.Empty;
    public decimal WeightKg { get; set; }
    public bool Accepted { get; set; }
    public string? RejectionReason { get; set; }
    public Guid? InventoryItemId { get; set; }
}
