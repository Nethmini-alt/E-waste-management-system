namespace EWasteManagement.API.Infrastructure.BackgroundTasks;

/// <summary>
/// Queues a workflow id for the chain to run in the background, outside the
/// lifetime of the HTTP request that created it. Deliberately NOT a plain
/// fire-and-forget Task (the pattern the old SubmissionService used) —
/// that pattern can silently lose work if scoped services are disposed or
/// the app pool recycles mid-flight. A Channel survives that; a bare Task
/// does not.
/// </summary>
public interface IWorkflowBackgroundQueue
{
    void Enqueue(Guid workflowId);
    IAsyncEnumerable<Guid> DequeueAllAsync(CancellationToken ct);
}
