using System.Threading.Channels;

namespace EWasteManagement.API.Infrastructure.BackgroundTasks;

public class MaterialRestockQueue : IMaterialRestockQueue
{
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>();

    public void Enqueue(Guid inventoryItemId) => _channel.Writer.TryWrite(inventoryItemId);

    public IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken cancellationToken)
        => _channel.Reader.ReadAllAsync(cancellationToken);
}