using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Events;

/// <summary>
/// Raised whenever InventoryItem.TransitionTo() successfully changes status.
/// The registered handler turns this into a ProcessingLog row — so no status
/// change can happen without an audit row being written automatically.
/// </summary>
public class InventoryStatusChangedEvent : IDomainEvent
{
    public Guid InventoryItemId { get; }
    public InventoryStatus PreviousStatus { get; }
    public InventoryStatus NewStatus { get; }
    public Guid StaffId { get; }
    public string? Notes { get; }
    public DateTime OccurredAt { get; }

    public InventoryStatusChangedEvent(Guid inventoryItemId, InventoryStatus previousStatus,
        InventoryStatus newStatus, Guid staffId, string? notes)
    {
        InventoryItemId = inventoryItemId;
        PreviousStatus = previousStatus;
        NewStatus = newStatus;
        StaffId = staffId;
        Notes = notes;
        OccurredAt = DateTime.UtcNow;
    }
}