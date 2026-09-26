using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using EWasteManagement.API.Features.Auth.Entities;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Services;

public interface IBuyerService
{
    Task<IReadOnlyList<BuyerResponse>> GetAllAsync(CancellationToken ct = default);
    Task<BuyerResponse> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<BuyerResponse> CreateAsync(CreateBuyerRequest request, CancellationToken ct = default);
    Task<BuyerResponse> UpdateAsync(Guid id, UpdateBuyerRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<AvailableUserResponse>> GetAvailableUsersAsync(CancellationToken ct = default);
    Task<BuyerResponse> RegisterBuyerAsync(RegisterBuyerRequest request, CancellationToken ct = default);
}

public class BuyerService : IBuyerService
{
    private readonly ApplicationDbContext _db;

    public BuyerService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<BuyerResponse>> GetAllAsync(CancellationToken ct = default)
    {
        return await _db.Buyers
            .AsNoTracking()
            .OrderByDescending(b => b.CreatedAt)
            .Select(b => Map(b))
            .ToListAsync(ct);
    }

    public async Task<BuyerResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var buyer = await _db.Buyers.AsNoTracking().FirstOrDefaultAsync(b => b.BuyerId == id, ct)
            ?? throw new KeyNotFoundException($"Buyer {id} not found.");
        return Map(buyer);
    }

    public async Task<BuyerResponse> CreateAsync(CreateBuyerRequest request, CancellationToken ct = default)
    {
        // Ensure the linked User exists and has role = Corporate
        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == request.UserId, ct)
            ?? throw new InvalidOperationException("Linked user does not exist.");

        if (user.Role.ToString() != "Corporate")
            throw new InvalidOperationException("Linked user must have role 'Corporate'.");

        // Prevent duplicate buyer for same user
        var exists = await _db.Buyers.AnyAsync(b => b.UserId == request.UserId, ct);
        if (exists)
            throw new InvalidOperationException("A buyer profile already exists for this user.");

        var buyer = new Buyer
        {
            UserId = request.UserId,
            CompanyName = request.CompanyName.Trim(),
            ContactPerson = request.ContactPerson.Trim(),
            Email = request.Email.Trim().ToLowerInvariant(),
            PhoneNumber = request.PhoneNumber?.Trim(),
            Address = request.Address?.Trim(),
            BuyerType = Enum.Parse<BuyerType>(request.BuyerType, true),
            Status = BuyerStatus.Pending
        };

        _db.Buyers.Add(buyer);
        await _db.SaveChangesAsync(ct);
        return Map(buyer);
    }

    public async Task<BuyerResponse> UpdateAsync(Guid id, UpdateBuyerRequest request, CancellationToken ct = default)
    {
        var buyer = await _db.Buyers.FirstOrDefaultAsync(b => b.BuyerId == id, ct)
            ?? throw new KeyNotFoundException($"Buyer {id} not found.");

        buyer.CompanyName = request.CompanyName.Trim();
        buyer.ContactPerson = request.ContactPerson.Trim();
        buyer.Email = request.Email.Trim().ToLowerInvariant();
        buyer.PhoneNumber = request.PhoneNumber?.Trim();
        buyer.Address = request.Address?.Trim();
        buyer.BuyerType = Enum.Parse<BuyerType>(request.BuyerType, true);
        buyer.Status = Enum.Parse<BuyerStatus>(request.Status, true);
        buyer.UpdatedAt = DateTime.UtcNow;

        await _db.SaveChangesAsync(ct);
        return Map(buyer);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var buyer = await _db.Buyers.FirstOrDefaultAsync(b => b.BuyerId == id, ct)
            ?? throw new KeyNotFoundException($"Buyer {id} not found.");

        buyer.IsDeleted = true;
        buyer.DeletedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<AvailableUserResponse>> GetAvailableUsersAsync(CancellationToken ct = default)
    {
        // Corporate users who don't yet have a Buyer profile
        var usedIds = await _db.Buyers
            .Select(b => b.UserId)
            .ToListAsync(ct);

        var users = await _db.Users
            .AsNoTracking()
            .Where(u => u.Role == EWasteManagement.API.Features.Auth.Entities.UserRole.Corporate)
            .Where(u => !usedIds.Contains(u.UserId))
            .OrderBy(u => u.FullName)
            .Select(u => new AvailableUserResponse
            {
                UserId = u.UserId,
                FullName = u.FullName,
                Email = u.Email
            })
            .ToListAsync(ct);

        return users;
    }

    public async Task<BuyerResponse> RegisterBuyerAsync(RegisterBuyerRequest request, CancellationToken ct = default)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        if (await _db.Users.AnyAsync(u => u.Email == email, ct))
            throw new InvalidOperationException("Email is already registered.");

        // Create the User with role=Corporate
        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            Phone = request.PhoneNumber?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = UserRole.Corporate
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync(ct);

        // Create the Buyer profile linked to that user
        var buyer = new Buyer
        {
            UserId = user.UserId,
            CompanyName = request.CompanyName.Trim(),
            ContactPerson = request.ContactPerson.Trim(),
            Email = email,
            PhoneNumber = request.PhoneNumber?.Trim(),
            Address = request.Address?.Trim(),
            BuyerType = Enum.Parse<BuyerType>(request.BuyerType, true),
            Status = BuyerStatus.Pending  // staff must activate
        };
        _db.Buyers.Add(buyer);
        await _db.SaveChangesAsync(ct);

        return Map(buyer);
    }

    private static BuyerResponse Map(Buyer b) => new()
    {
        BuyerId = b.BuyerId,
        UserId = b.UserId,
        CompanyName = b.CompanyName,
        ContactPerson = b.ContactPerson,
        Email = b.Email,
        PhoneNumber = b.PhoneNumber,
        Address = b.Address,
        BuyerType = b.BuyerType.ToString(),
        Status = b.Status.ToString(),
        CreatedAt = b.CreatedAt,
        UpdatedAt = b.UpdatedAt
    };
}