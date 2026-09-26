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

    // The Matcher agent's recommended collector. Used if they're still
    // eligible when the job is created; otherwise normal matching picks
    // someone and the history records that the recommendation was replaced.
    public Guid? PreferredCollectorId { get; set; }
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
    public string? CollectorName { get; set; }
    public string Status { get; set; } = string.Empty;

    public string PickupAddress { get; set; } = string.Empty;
    public decimal? PickupLatitude { get; set; }
    public decimal? PickupLongitude { get; set; }

    public decimal? RequiredCapacityKg { get; set; }
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
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}


// --- Staff actions -------------------------------------------------------

// PUT /api/v1/jobs/{id}/address — fix an address that couldn't be geocoded.
public class UpdateJobAddressDto
{
    public string PickupAddress { get; set; } = string.Empty;
}

// PUT /api/v1/jobs/{id}/reassign
// CollectorId set   -> staff hand-pick that collector.
// CollectorId null  -> re-run automatic matching (e.g. new collectors came online).
public class ReassignJobDto
{
    public Guid? CollectorId { get; set; }
}

public class JobAssignmentHistoryDto
{
    public Guid HistoryId { get; set; }
    public Guid CollectorId { get; set; }
    public string CollectorName { get; set; } = string.Empty;
    public string Outcome { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public DateTime Timestamp { get; set; }
}
