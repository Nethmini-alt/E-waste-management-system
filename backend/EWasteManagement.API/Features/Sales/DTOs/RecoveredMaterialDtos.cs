namespace EWasteManagement.API.Features.Sales.DTOs;

/// <summary>
/// Read-only view of a recovered material batch. Owned by Component C.
/// Component D consumes this data for commercial operations (pricing, orders, AI planning).
/// </summary>
public class RecoveredMaterialResponse
{
    /// <summary>Unique batch id in Component C's domain.</summary>
    public Guid RecoveredMaterialId { get; set; }

    /// <summary>e.g. "Copper", "Aluminium", "Gold", "PCB", "Plastic"</summary>
    public string MaterialType { get; set; } = string.Empty;

    public decimal QuantityKg { get; set; }

    /// <summary>Quality grade assigned by Component C, e.g. "A", "B", "C".</summary>
    public string QualityGrade { get; set; } = string.Empty;

    /// <summary>Processing status from Component C: "Ready", "InProgress", "Rejected".</summary>
    public string ProcessingStatus { get; set; } = string.Empty;

    /// <summary>Has Component C validated that this batch is safe to sell/export?</summary>
    public bool SafetyValidated { get; set; }

    /// <summary>Workflow id linking back to the original submission (if any).</summary>
    public Guid? WorkflowId { get; set; }

    /// <summary>When the batch became available.</summary>
    public DateTime AvailableAt { get; set; }
}