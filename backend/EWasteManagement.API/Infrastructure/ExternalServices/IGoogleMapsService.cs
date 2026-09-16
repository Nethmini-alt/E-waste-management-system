namespace EWasteManagement.API.Infrastructure.ExternalServices;

public interface IGoogleMapsService
{
    /// <summary>
    /// Turns a free-text address into coordinates. Returns null if Google
    /// couldn't resolve the address (ambiguous, incomplete, or a network/API
    /// failure) — callers should treat null as "flag for staff", not throw.
    /// </summary>
    Task<(decimal Latitude, decimal Longitude)?> GeocodeAsync(string address);

    /// <summary>
    /// Driving distance and duration between two points, used both for
    /// ranking collectors during matching and for showing an ETA on a job.
    /// </summary>
    Task<(decimal DistanceKm, int DurationMinutes)?> GetDistanceAsync(
        decimal originLat, decimal originLng,
        decimal destLat, decimal destLng);
}
