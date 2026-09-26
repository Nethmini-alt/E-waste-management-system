using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Infrastructure.BackgroundTasks;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Events;

public class InventoryStatusChangedEventHandler : IDomainEventHandler<InventoryStatusChangedEvent>
{
    private readonly ApplicationDbContext _db;
    private readonly IMaterialRestockQueue _restockQueue;

    public InventoryStatusChangedEventHandler(ApplicationDbContext db, IMaterialRestockQueue restockQueue)
    {
        _db = db;
        _restockQueue = restockQueue;
    }

    public async Task Handle(InventoryStatusChangedEvent domainEvent, CancellationToken cancellationToken = default)
    {
        _db.ProcessingLogs.Add(new ProcessingLog
        {
            InventoryItemId = domainEvent.InventoryItemId,
            Action = domainEvent.NewStatus.ToString(),
            PerformedByStaffId = domainEvent.StaffId,
            PerformedAt = domainEvent.OccurredAt,
            Notes = domainEvent.Notes
        });

        await _db.SaveChangesAsync(cancellationToken);

        if (domainEvent.NewStatus == InventoryStatus.ReadyForSale
            && domainEvent.PreviousStatus != InventoryStatus.ReadyForSale)
        {
            _restockQueue.Enqueue(domainEvent.InventoryItemId);
        }
    }
}