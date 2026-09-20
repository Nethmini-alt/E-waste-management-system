namespace EWasteManagement.API.Shared.Common;

/// <summary>
/// Implement this per event type you want to react to. Register implementations in DI
/// (builder.Services.AddScoped&lt;IDomainEventHandler&lt;SomeEvent&gt;, SomeHandler&gt;()) — no MediatR needed.
/// </summary>
public interface IDomainEventHandler<in TEvent> where TEvent : IDomainEvent
{
    Task Handle(TEvent domainEvent, CancellationToken cancellationToken = default);
}
