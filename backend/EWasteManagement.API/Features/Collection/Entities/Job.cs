namespace EWasteManagement.API.Features.Collection.Entities;

public class Job
{
    public Guid JobId { get; set; } = Guid.NewGuid();

    // Plain id, not an EF-enforced FK — Submission currently lives under the
    // EWasteManagement.Api.Entities namespace (Component A), which we don't
    // want Collection to take a hard dependency on yet. Still indexed.
    public Guid SubmissionId { get; set; }

    // Null until a collector is matched and assigned.
    public Guid? CollectorId { get; set; }
    public Collector? CollectorEntity { get; set; }

    public JobStatus Status { get; set; } = JobStatus.Assigned;

    // Copied from the submission's PickupAddress at job-creation time, then
    // geocoded via GeoService (OpenStreetMap). Kept on Job rather than written back to
    // Submission, per the plan discussed with the team.
    public string PickupAddress { get; set; } = string.Empty;
    public decimal? PickupLatitude { get; set; }
    public decimal? PickupLongitude { get; set; }

    // The Analyzer's weight estimate, kept so every re-match for this job
    // (after a rejection, or when staff re-run matching) still skips
    // vehicles that are too small. Null means no capacity filter.
    public decimal? RequiredCapacityKg { get; set; }

    public DateTime? ScheduledWindowStart { get; set; }
    public DateTime? ScheduledWindowEnd { get; set; }
    public int? EstimatedEtaMinutes { get; set; }
    public decimal? EstimatedDistanceKm { get; set; }

    // Collection confirmation evidence, filled in on complete.
    public string? PhotoUrl { get; set; }
    public decimal? MeasuredWeightKg { get; set; }
    public string? Notes { get; set; }
    public string? RejectionReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? RespondedAt { get; set; }

    // When the collector set off (Accepted -> InProgress, from the app's Navigate button).
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}
