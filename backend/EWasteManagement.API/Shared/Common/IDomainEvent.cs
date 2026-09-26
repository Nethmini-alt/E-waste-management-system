namespace EWasteManagement.API.Shared.Common;

/// <summary>
/// Marker interface for something that happened in the domain (e.g. "an item's status changed")
/// that other parts of the system (audit logging, payment creation, notifications) may want to react to.
/// OccurredAt is a real property (not computed on read) — implementers must set it once, at the moment
/// the event is raised, so the timestamp reflects when it happened, not when someone later reads it.
/// </summary>
public interface IDomainEvent
{
    DateTime OccurredAt { get; }
}
