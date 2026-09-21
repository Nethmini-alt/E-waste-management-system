using System.ComponentModel.DataAnnotations;

namespace EWasteManagement.API.Features.Collection.DTOs;

// POST /collectors/geocode (the Matcher agent's geocode_address tool call).
public class GeocodeRequestDto
{
    [Required, StringLength(300, MinimumLength = 5)]
    public string Address { get; set; } = string.Empty;
}

// Resolved = false with null coordinates means the address could not be found.
// That is a normal answer (HTTP 200), not an error — the agent flags it for staff.
public class GeocodeResponseDto
{
    public bool Resolved { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
}
