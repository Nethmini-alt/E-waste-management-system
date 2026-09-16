namespace EWasteManagement.API.Features.Processing.Entities;

public enum OriginType
{
    JobCollection,
    ExtraWaste
}

// Public setter for now on InventoryItem.Status — M3 replaces direct assignment with a guarded
// TransitionTo() method that validates against legal moves and logs every change. Don't build
// anything that depends on setting Status directly outside of the initial "Received" creation,
// since that call site will need to change in M3.
public enum InventoryStatus
{
    Received,
    Sorting,
    Dismantling,
    Classified,
    ReadyForSale,
    ExportOnly,
    OnHold
}

public enum ClassificationCategory
{
    Reusable,
    LocalRecyclable,
    Hazardous,
    ExportOnly
}

public enum ClassificationSource
{
    Manual,
    Ai
}

public enum PaymentSourceType
{
    Job,
    ExtraWaste
}

public enum PaymentStatus
{
    Pending,
    Paid
}
