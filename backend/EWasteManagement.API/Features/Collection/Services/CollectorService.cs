using EWasteManagement.API.Features.Collection.DTOs;
using EWasteManagement.API.Features.Collection.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Collection.Services;

public interface ICollectorService
{
    Task<CollectorResponseDto> CreateProfileAsync(Guid userId, CreateCollectorProfileDto dto);
    Task<CollectorResponseDto?> GetByUserIdAsync(Guid userId);
    Task<CollectorResponseDto?> GetByIdAsync(Guid collectorId);
    Task<CollectorResponseDto> UpdateAvailabilityAsync(Guid collectorId, Guid requestingUserId, UpdateAvailabilityDto dto);
    Task<CollectorResponseDto> UpdateLocationAsync(Guid collectorId, Guid requestingUserId, UpdateLocationDto dto);
}

public class CollectorService : ICollectorService
{
    private readonly ApplicationDbContext _db;

    public CollectorService(ApplicationDbContext db) => _db = db;

    public async Task<CollectorResponseDto> CreateProfileAsync(Guid userId, CreateCollectorProfileDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.VehicleType))
            throw new ArgumentException("VehicleType is required.");

        if (dto.CapacityKg <= 0)
            throw new ArgumentException("CapacityKg must be greater than zero.");

        var existing = await _db.Collectors.FirstOrDefaultAsync(c => c.UserId == userId);
        if (existing is not null)
            throw new InvalidOperationException("A collector profile already exists for this user.");

        var collector = new Collector
        {
            UserId = userId,
            VehicleType = dto.VehicleType,
            CapacityKg = dto.CapacityKg
        };

        _db.Collectors.Add(collector);
        await _db.SaveChangesAsync();

        return ToDto(collector);
    }

    public async Task<CollectorResponseDto?> GetByUserIdAsync(Guid userId)
    {
        var collector = await _db.Collectors.FirstOrDefaultAsync(c => c.UserId == userId);
        return collector is null ? null : ToDto(collector);
    }

    public async Task<CollectorResponseDto?> GetByIdAsync(Guid collectorId)
    {
        var collector = await _db.Collectors.FindAsync(collectorId);
        return collector is null ? null : ToDto(collector);
    }

    public async Task<CollectorResponseDto> UpdateAvailabilityAsync(Guid collectorId, Guid requestingUserId, UpdateAvailabilityDto dto)
    {
        var collector = await GetOwnedCollectorAsync(collectorId, requestingUserId);

        collector.IsAvailable = dto.IsAvailable;
        collector.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return ToDto(collector);
    }

    public async Task<CollectorResponseDto> UpdateLocationAsync(Guid collectorId, Guid requestingUserId, UpdateLocationDto dto)
    {
        var collector = await GetOwnedCollectorAsync(collectorId, requestingUserId);

        collector.CurrentLatitude = dto.Latitude;
        collector.CurrentLongitude = dto.Longitude;
        collector.LocationUpdatedAt = DateTime.UtcNow;
        collector.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync();
        return ToDto(collector);
    }

    // Loads the collector and checks that the caller owns this profile.
    // Every write endpoint goes through this — a collector should only ever
    // be able to modify their own availability/location, never someone else's,
    // even if they guess another collector's id.
    private async Task<Collector> GetOwnedCollectorAsync(Guid collectorId, Guid requestingUserId)
    {
        var collector = await _db.Collectors.FindAsync(collectorId)
            ?? throw new KeyNotFoundException("Collector not found.");

        if (collector.UserId != requestingUserId)
            throw new UnauthorizedAccessException("You do not have permission to modify this collector profile.");

        return collector;
    }

    private static CollectorResponseDto ToDto(Collector c) => new()
    {
        CollectorId = c.CollectorId,
        UserId = c.UserId,
        VehicleType = c.VehicleType,
        CapacityKg = c.CapacityKg,
        IsAvailable = c.IsAvailable,
        Rating = c.Rating,
        CurrentLatitude = c.CurrentLatitude,
        CurrentLongitude = c.CurrentLongitude,
        LocationUpdatedAt = c.LocationUpdatedAt,
        CreatedAt = c.CreatedAt
    };
}
