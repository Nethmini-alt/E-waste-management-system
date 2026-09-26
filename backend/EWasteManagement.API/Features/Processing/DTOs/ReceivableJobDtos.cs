namespace EWasteManagement.API.Features.Processing.DTOs;

/// <summary>
/// A completed job that has an assigned collector and has NOT yet been received into inventory.
/// Filtered on the server, so a page refresh never brings received jobs back.
/// </summary>
public class ReceivableJobResponse
{
    public Guid JobId { get; set; }
    public Guid CollectorId { get; set; }
    public string? CollectorName { get; set; }
    public string? CollectorVehicleType { get; set; }
    public string PickupAddress { get; set; } = string.Empty;
    public decimal? ReportedWeightKg { get; set; }
    public decimal? EstimatedDistanceKm { get; set; }
    public DateTime? CompletedAt { get; set; }

    /// <summary>The category the customer chose on the submission, as they wrote it (null if unknown).</summary>
    public string? SubmissionCategory { get; set; }

    /// <summary>
    /// <see cref="SubmissionCategory"/> matched to the item-type list, pre-selected on the receive form.
    /// Null when the category is not on the list — staff must choose the type.
    /// </summary>
    public string? SuggestedItemType { get; set; }
}
