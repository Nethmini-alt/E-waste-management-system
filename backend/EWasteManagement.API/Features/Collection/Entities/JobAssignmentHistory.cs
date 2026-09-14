namespace EWasteManagement.API.Features.Collection.Entities;

// Records every time a job was offered to a collector, and what happened.
// This is what lets the reassignment logic exclude collectors who already
// rejected a given job, and doubles as the audit trail the project spec
// asks for (observability of the agent workflow).

public enum AssignmentOutcome
{
    Assigned,
    Accepted,
    Rejected
}

public class JobAssignmentHistory
{
    public Guid HistoryId { get; set; } = Guid.NewGuid();
    public Guid JobId { get; set; }
    public Guid CollectorId { get; set; }

    public AssignmentOutcome Outcome { get; set; }
    public string? Reason { get; set; }

    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}
