namespace EWasteManagement.API.Features.Sales.Exceptions;

/// <summary>
/// Raised when saving would leave two Approved prices for the same material type at once.
/// The database enforces this with a partial unique index
/// (IX_material_pricing_material_type_approved_unique); this exception turns the raw
/// constraint violation into an actionable message and maps to HTTP 409.
/// </summary>
public class DuplicateApprovedPricingException : Exception
{
    public DuplicateApprovedPricingException(string materialType)
        : base($"Another approved price for '{materialType}' already exists. " +
               "Mark it Expired first, then approve this one.") { }
}
