using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.Tests.TestHelpers;

// A real dispatcher would need the full DI container wired up. These tests are about the
// service's own logic (idempotency, accept/reject branching), not the event-handler chain
// Day 1 already tested separately — so a no-op stand-in is the right amount of test here.
public class NoOpDomainEventDispatcher : IDomainEventDispatcher
{
    public Task DispatchAsync(IEnumerable<IDomainEvent> domainEvents, CancellationToken cancellationToken = default)
        => Task.CompletedTask;
}