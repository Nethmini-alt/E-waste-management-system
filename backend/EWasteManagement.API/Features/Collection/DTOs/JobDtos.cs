using EWasteManagement.API.Features.Collection.Entities;

namespace EWasteManagement.API.Features.Collection.DTOs;

// PickupAddress is passed in explicitly by the caller (the staff dashboard,
// or whatever finalizes approval) rather than read from Submission directly —
// keeps this component decoupled from Submission's schema, as discussed.
public class CreateJobDto
{
    public Guid SubmissionId { get; set; }
    public string PickupAddress { get; set; } = string.Empty;
    public decimal? RequiredCapacityKg { get; set; }
    public DateTime? ScheduledWindowStart { get; set; }
    public DateTime? ScheduledWindowEnd { get; set; }

    // Set when an agent plan is approved: give the job to the collector the Matcher chose (after re-checking
    // they are still available) instead of picking the best one again.
    public Guid? PreferredCollectorId { get; set; }

    // Coordinates the Matcher already resolved. When both are set the address is not geocoded again.
    public decimal? PickupLatitude { get; set; }
    public decimal? PickupLongitude { get; set; }
}

public class RejectJobDto
{
    public string? Reason { get; set; }
}

public class CompleteJobDto
{
    public string PhotoUrl { get; set; } = string.Empty;
    public decimal MeasuredWeightKg { get; set; }
    public string? Notes { get; set; }
}

public class JobResponseDto
{
    public Guid JobId { get; set; }
    public Guid SubmissionId { get; set; }
    public Guid? CollectorId { get; set; }
    public string Status { get; set; } = string.Empty;

    public string PickupAddress { get; set; } = string.Empty;
    public decimal? PickupLatitude { get; set; }
    public decimal? PickupLongitude { get; set; }

    public DateTime? ScheduledWindowStart { get; set; }
    public DateTime? ScheduledWindowEnd { get; set; }
    public int? EstimatedEtaMinutes { get; set; }
    public decimal? EstimatedDistanceKm { get; set; }

    public string? PhotoUrl { get; set; }
    public decimal? MeasuredWeightKg { get; set; }
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }

    public DateTime CreatedAt { get; set; }
    public DateTime? RespondedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
