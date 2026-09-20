namespace EWasteManagement.API.Features.Collection.Entities;

// IMPORTANT: Only append new statuses at the end of this list.
// EF Core stores this enum as a lowercase string via a value converter
// (see JobConfiguration), so appending is safe either way — but keep the
// convention consistent with UserRole.

public enum JobStatus
{
    Assigned,
    Accepted,
    Rejected,
    InProgress,
    Completed,
    Cancelled,
    NoCollectorAvailable,
    PickupLocationUnresolved
}
