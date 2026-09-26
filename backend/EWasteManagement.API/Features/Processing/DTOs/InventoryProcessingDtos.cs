using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.DTOs;

public class TransitionInventoryStatusRequest
{
    public InventoryStatus NextStatus { get; set; }
    public string? Notes { get; set; }
    public Guid? NewLocationId { get; set; }
}

public class InventoryItemStatusResponse
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public Guid CurrentLocationId { get; set; }
}

public class CreateChildInventoryItemRequest
{
    public string ItemType { get; set; } = string.Empty;
    public decimal WeightKg { get; set; }
}

public class AddDismantleLogRequest
{
    public string Description { get; set; } = string.Empty;
    public decimal? RemainingWeightKg { get; set; }
    public List<CreateChildInventoryItemRequest> ChildItems { get; set; } = new();
}

public class DismantleLogResponse
{
    public Guid InventoryItemId { get; set; }
    public decimal? UpdatedWeightKg { get; set; }
    public List<Guid> ChildInventoryItemIds { get; set; } = new();
}

public class ClassifyInventoryItemRequest
{
    public ClassificationCategory Category { get; set; }
    public string? SubCategory { get; set; }
    public ClassificationSource Source { get; set; } = ClassificationSource.Manual;
    public decimal? ConfidenceScore { get; set; }
    public bool IsFinal { get; set; } = true;
}

public class ClassificationResponse
{
    public Guid InventoryItemId { get; set; }
    public string Category { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // reflects auto-OnHold if hazardous
    public bool IsFinal { get; set; }
}

public class ProcessingLogEntryResponse
{
    public string Action { get; set; } = string.Empty;
    public Guid PerformedByStaffId { get; set; }
    public DateTime PerformedAt { get; set; }
    public string? Notes { get; set; }
}

public class MoveInventoryLocationRequest
{
    public Guid NewLocationId { get; set; }
}

public class ValidateClassificationRequest
{
    public ClassificationCategory ProposedCategory { get; set; }
    public string? ProposedSubCategory { get; set; }
    public decimal? ConfidenceScore { get; set; }
}

public class ValidateClassificationResponse
{
    public bool Approved { get; set; }
    public bool RequiresHumanReview { get; set; }
    public List<string> Reasons { get; set; } = new();
}