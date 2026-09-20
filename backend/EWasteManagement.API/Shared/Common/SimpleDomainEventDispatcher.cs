using Microsoft.Extensions.DependencyInjection;

namespace EWasteManagement.API.Shared.Common;

/// <summary>
/// Minimal in-process dispatcher: looks up any registered IDomainEventHandler&lt;TEvent&gt; for each event's
/// concrete type and invokes it. Deliberately not MediatR — this is ~20 lines and does exactly what
/// this project needs (in-process, single-database, no cross-service messaging).
/// </summary>
public class SimpleDomainEventDispatcher : IDomainEventDispatcher
{
    private readonly IServiceProvider _serviceProvider;

    public SimpleDomainEventDispatcher(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task DispatchAsync(IEnumerable<IDomainEvent> domainEvents, CancellationToken cancellationToken = default)
    {
        foreach (var domainEvent in domainEvents)
        {
            var handlerType = typeof(IDomainEventHandler<>).MakeGenericType(domainEvent.GetType());
            var handlers = _serviceProvider.GetServices(handlerType);

            foreach (var handler in handlers)
            {
                if (handler is null) continue;
                var method = handlerType.GetMethod("Handle")!;
                var task = (Task)method.Invoke(handler, new object[] { domainEvent, cancellationToken })!;
                await task;
            }
        }
    }
}
