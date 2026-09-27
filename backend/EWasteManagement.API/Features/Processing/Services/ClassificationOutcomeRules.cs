using EWasteManagement.API.Features.Processing.Entities;

namespace EWasteManagement.API.Features.Processing.Services;

/// <summary>
/// Which outcome a classified item may be given, decided by its category:
///   Reusable / LocalRecyclable → ReadyForSale
///   ExportOnly                 → ExportOnly
///   Hazardous                  → OnHold (applied automatically by ClassifyAsync)
/// OnHold is always allowed as a manual hold, whatever the category.
/// </summary>
public static class ClassificationOutcomeRules
{
    /// <summary>The non-hold outcome the category leads to, or null when there is none (Hazardous).</summary>
    public static InventoryStatus? OutcomeFor(ClassificationCategory category) => category switch
    {
        ClassificationCategory.Reusable or ClassificationCategory.LocalRecyclable => InventoryStatus.ReadyForSale,
        ClassificationCategory.ExportOnly => InventoryStatus.ExportOnly,
        _ => null
    };

    public static bool Allows(ClassificationCategory category, InventoryStatus outcome)
        => outcome == InventoryStatus.OnHold || OutcomeFor(category) == outcome;
}
