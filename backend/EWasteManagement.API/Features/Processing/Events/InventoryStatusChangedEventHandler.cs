using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Events;

public class InventoryStatusChangedEventHandler : IDomainEventHandler<InventoryStatusChangedEvent>
{
    private readonly ApplicationDbContext _db;

    public InventoryStatusChangedEventHandler(ApplicationDbContext db) => _db = db;

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
    }
}