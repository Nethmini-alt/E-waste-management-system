namespace EWasteManagement.API.Shared.Common;

/// <summary>
/// Base class for every Component C entity that needs an audit trail via domain events.
/// Concurrency is handled separately via Npgsql's xmin system column (see ApplicationDbContext.OnModelCreating),
/// so this class does not carry an explicit RowVersion property.
/// </summary>
public abstract class BaseEntity
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    private readonly List<IDomainEvent> _domainEvents = new();

    /// <summary>Events raised by this entity since it was last saved. Cleared automatically after dispatch.</summary>
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    /// <summary>Call from within entity methods (e.g. TransitionTo) to record something that happened, without
    /// coupling the entity to how it gets logged/handled.</summary>
    protected void RaiseDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);

    public void ClearDomainEvents() => _domainEvents.Clear();
}
