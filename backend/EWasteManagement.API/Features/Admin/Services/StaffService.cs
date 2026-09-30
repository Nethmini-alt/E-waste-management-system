using EWasteManagement.API.Features.Admin.DTOs;
using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Admin.Services;

public interface IStaffService
{
    Task<IReadOnlyList<StaffMemberResponse>> ListAsync(CancellationToken cancellationToken = default);
    Task<StaffMemberResponse> CreateAsync(CreateStaffRequest request, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid userId, Guid actingAdminId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffActivitySummaryResponse>> GetActivitySummaryAsync(CancellationToken cancellationToken = default);
    Task<IReadOnlyList<StaffActivityEntryResponse>> GetRecentActivityAsync(Guid userId, int take, CancellationToken cancellationToken = default);
}

public class StaffService : IStaffService
{
    private readonly ApplicationDbContext _db;

    public StaffService(ApplicationDbContext db) => _db = db;

    public async Task<IReadOnlyList<StaffMemberResponse>> ListAsync(CancellationToken cancellationToken = default)
    {
        var staff = await _db.Users.AsNoTracking()
            .Where(u => u.Role == UserRole.Staff)
            .OrderBy(u => u.FullName)
            .ToListAsync(cancellationToken);

        return staff.Select(Map).ToList();
    }

    public async Task<StaffMemberResponse> CreateAsync(CreateStaffRequest request, CancellationToken cancellationToken = default)
    {
        var email = request.Email.Trim();

        // Deleted accounts still hold their email (unique index), so check them too.
        if (await _db.Users.IgnoreQueryFilters().AnyAsync(u => u.Email == email, cancellationToken))
            throw new InvalidOperationException("Email is already registered.");

        var user = new User
        {
            FullName = request.FullName.Trim(),
            Email = email,
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = UserRole.Staff,
            StaffType = request.StaffType
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync(cancellationToken);
        return Map(user);
    }

    // Soft delete: the staff member's id stays on processing logs, receipts and payments, so their
    // past work remains reviewable. The account can no longer sign in.
    public async Task DeleteAsync(Guid userId, Guid actingAdminId, CancellationToken cancellationToken = default)
    {
        if (userId == actingAdminId)
            throw new InvalidOperationException("You cannot delete your own account.");

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId && u.Role == UserRole.Staff, cancellationToken)
            ?? throw new KeyNotFoundException($"Staff member '{userId}' was not found.");

        user.IsDeleted = true;
        user.IsActive = false;
        user.DeletedAt = DateTime.UtcNow;
        user.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<StaffActivitySummaryResponse>> GetActivitySummaryAsync(CancellationToken cancellationToken = default)
    {
        var staff = await _db.Users.IgnoreQueryFilters().AsNoTracking()
            .Where(u => u.Role == UserRole.Staff)
            .ToListAsync(cancellationToken);
        var ids = staff.Select(u => u.UserId).ToList();

        var logCounts = await _db.ProcessingLogs.AsNoTracking()
            .Where(l => ids.Contains(l.PerformedByStaffId))
            .GroupBy(l => new { l.PerformedByStaffId, l.Action })
            .Select(g => new { g.Key.PerformedByStaffId, g.Key.Action, Count = g.Count(), Last = g.Max(l => l.PerformedAt) })
            .ToListAsync(cancellationToken);

        var receipts = await _db.ExtraWasteReceipts.AsNoTracking()
            .Where(r => ids.Contains(r.ReceivedByStaffId))
            .GroupBy(r => r.ReceivedByStaffId)
            .Select(g => new { StaffId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StaffId, x => x.Count, cancellationToken);

        var classifications = await _db.ClassificationRecords.AsNoTracking()
            .Where(c => c.ClassifiedByStaffId != null && ids.Contains(c.ClassifiedByStaffId.Value))
            .GroupBy(c => c.ClassifiedByStaffId!.Value)
            .Select(g => new { StaffId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StaffId, x => x.Count, cancellationToken);

        var raised = await _db.CollectorPayments.AsNoTracking()
            .Where(p => p.CreatedByStaffId != null && ids.Contains(p.CreatedByStaffId.Value))
            .GroupBy(p => p.CreatedByStaffId!.Value)
            .Select(g => new { StaffId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StaffId, x => x.Count, cancellationToken);

        // Amounts are summed in memory: SQLite (used by the tests) cannot SUM decimals.
        var paid = (await _db.CollectorPayments.AsNoTracking()
                .Where(p => p.PaidByStaffId != null && ids.Contains(p.PaidByStaffId.Value))
                .Select(p => new { StaffId = p.PaidByStaffId!.Value, p.Amount, p.PaidAt })
                .ToListAsync(cancellationToken))
            .GroupBy(p => p.StaffId)
            .ToDictionary(g => g.Key, g => new { Count = g.Count(), Amount = g.Sum(p => p.Amount), Last = g.Max(p => p.PaidAt) });

        return staff.Select(u =>
        {
            var logs = logCounts.Where(l => l.PerformedByStaffId == u.UserId).ToList();
            int CountOf(string action) => logs.Where(l => l.Action == action).Sum(l => l.Count);
            paid.TryGetValue(u.UserId, out var paidInfo);

            var lastLog = logs.Count == 0 ? (DateTime?)null : logs.Max(l => l.Last);
            var lastPaid = paidInfo?.Last;

            return new StaffActivitySummaryResponse
            {
                UserId = u.UserId,
                FullName = u.FullName,
                Email = u.Email,
                StaffType = (u.StaffType ?? StaffType.Management).ToString(),
                IsDeleted = u.IsDeleted,
                ItemsReceived = CountOf("Received"),
                ExtraWasteReceipts = receipts.GetValueOrDefault(u.UserId),
                DismantleSteps = CountOf("DismantleStep"),
                Classifications = classifications.GetValueOrDefault(u.UserId),
                LocationMoves = CountOf("LocationMoved"),
                TotalInventoryActions = logs.Sum(l => l.Count),
                PaymentsRaised = raised.GetValueOrDefault(u.UserId),
                PaymentsPaid = paidInfo?.Count ?? 0,
                AmountPaid = paidInfo?.Amount ?? 0m,
                LastActivityAt = lastLog > lastPaid || lastPaid is null ? lastLog : lastPaid
            };
        })
        .OrderBy(s => s.IsDeleted)
        .ThenBy(s => s.FullName)
        .ToList();
    }

    public async Task<IReadOnlyList<StaffActivityEntryResponse>> GetRecentActivityAsync(
        Guid userId, int take, CancellationToken cancellationToken = default)
    {
        var exists = await _db.Users.IgnoreQueryFilters()
            .AnyAsync(u => u.UserId == userId && u.Role == UserRole.Staff, cancellationToken);
        if (!exists)
            throw new KeyNotFoundException($"Staff member '{userId}' was not found.");

        return await _db.ProcessingLogs.AsNoTracking()
            .Where(l => l.PerformedByStaffId == userId)
            .OrderByDescending(l => l.PerformedAt)
            .Take(Math.Clamp(take, 1, 200))
            .Select(l => new StaffActivityEntryResponse
            {
                PerformedAt = l.PerformedAt,
                Action = l.Action,
                InventoryItemId = l.InventoryItemId,
                ItemType = l.InventoryItem!.ItemType,
                Notes = l.Notes
            })
            .ToListAsync(cancellationToken);
    }

    private static StaffMemberResponse Map(User u) => new()
    {
        UserId = u.UserId,
        FullName = u.FullName,
        Email = u.Email,
        Phone = u.Phone,
        StaffType = (u.StaffType ?? StaffType.Management).ToString(),
        IsActive = u.IsActive,
        CreatedAt = u.CreatedAt
    };
}
