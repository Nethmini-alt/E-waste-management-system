namespace EWasteManagement.API.Features.Processing.Entities;

public enum OriginType
{
    JobCollection,
    ExtraWaste
}

public enum InventoryStatus
{
    Received,
    Sorting,
    Dismantling,
    Classified,
    ReadyForSale,
    ExportOnly,
    OnHold,
    Recovered
}

// Unit = what came in through receiving; Component and Material are created by dismantling a parent.
public enum ItemKind
{
    Unit,
    Component,
    Material
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
