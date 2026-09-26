using EWasteManagement.API.Features.Processing.Events;
using EWasteManagement.API.Infrastructure.BackgroundTasks;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.Tests.TestHelpers;

public class DirectDomainEventDispatcher : IDomainEventDispatcher
{
    private readonly ApplicationDbContext _db;
    public DirectDomainEventDispatcher(ApplicationDbContext db) => _db = db;

    public async Task DispatchAsync(IEnumerable<IDomainEvent> domainEvents, CancellationToken cancellationToken = default)
    {
        foreach (var domainEvent in domainEvents)
            if (domainEvent is InventoryStatusChangedEvent statusChanged)
                await new InventoryStatusChangedEventHandler(_db, new NoOpMaterialRestockQueue()).Handle(statusChanged, cancellationToken);
    }

    private sealed class NoOpMaterialRestockQueue : IMaterialRestockQueue
    {
        public void Enqueue(Guid inventoryItemId) { }
        public IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken cancellationToken)
            => throw new NotImplementedException();
    }
}