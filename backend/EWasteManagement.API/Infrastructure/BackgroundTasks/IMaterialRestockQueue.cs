namespace EWasteManagement.API.Infrastructure.BackgroundTasks;

public interface IMaterialRestockQueue
{
    void Enqueue(Guid inventoryItemId);
    IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken cancellationToken);
}