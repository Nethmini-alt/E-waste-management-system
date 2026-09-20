namespace EWasteManagement.API.Shared.Common;

/// <summary>
/// Thrown by the InventoryItem state machine (added in M3) when code tries to move an item
/// to a status that isn't a legal next step. Declared here in M0 so the global exception
/// handler can map it to a 409 from day one.
/// </summary>
public class InvalidStatusTransitionException : Exception
{
    public InvalidStatusTransitionException(string fromStatus, string toStatus)
        : base($"Cannot transition inventory item from '{fromStatus}' to '{toStatus}'.")
    {
    }
}
