namespace EWasteManagement.API.Features.Processing.DTOs;

// POST /api/v1/rate-policies
public class CreateRatePolicyRequest
{
    public string ItemType { get; set; } = string.Empty;
    public decimal RatePerKg { get; set; }
}

// PUT /api/v1/rate-policies/{id} — replaces an active rate with a new one; the old row is kept as history.
public class ReviseRatePolicyRequest
{
    public decimal RatePerKg { get; set; }
}
