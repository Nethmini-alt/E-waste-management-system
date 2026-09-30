namespace EWasteManagement.API.Features.Processing.Services;

/// <summary>
/// Materials that must never go straight to ReadyForSale after dismantling, even if the worker
/// forgets to tick "hazardous": batteries, leaded CRT glass, mercury lamps, old capacitors, toner.
/// </summary>
public static class HazardousMaterialRules
{
    private static readonly string[] Keywords =
    {
        "battery", "batteries", "lithium", "li-ion", "lead", "mercury", "crt", "capacitor", "toner", "asbestos"
    };

    public static bool IsKnownHazardous(string materialType)
        => Keywords.Any(k => materialType.Contains(k, StringComparison.OrdinalIgnoreCase));
}
