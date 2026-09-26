using System.Threading.Channels;

namespace EWasteManagement.API.Infrastructure.BackgroundTasks;

public class WorkflowBackgroundQueue : IWorkflowBackgroundQueue
{
    // Unbounded: a submission burst should queue up, not get rejected.
    // For a student project's expected load this is a safe default.
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>();

    public void Enqueue(Guid workflowId) => _channel.Writer.TryWrite(workflowId);

    public IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken ct)
        => _channel.Reader.ReadAllAsync(ct);
}
