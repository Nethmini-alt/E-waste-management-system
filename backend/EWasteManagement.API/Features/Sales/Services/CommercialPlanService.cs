using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Services;

public interface ICommercialPlanService
{
    Task<IReadOnlyList<CommercialPlanResponse>> GetAllAsync(
        CommercialPlanFilter filter, CancellationToken ct = default);

    Task<CommercialPlanResponse> GetByIdAsync(Guid id, CancellationToken ct = default);

    Task<CommercialPlanResponse> CreateAsync(
        CreateCommercialPlanRequest request, Guid systemUserId, CancellationToken ct = default);

    Task<CommercialPlanResponse> DecideAsync(
        Guid id, ApprovalDecisionRequest request, Guid currentUserId, CancellationToken ct = default);

    Task<CommercialPlanResponse> MarkExecutedAsync(Guid id, Guid currentUserId, CancellationToken ct = default);
}

public class CommercialPlanService : ICommercialPlanService
{
    private readonly ApplicationDbContext _db;

    public CommercialPlanService(ApplicationDbContext db) => _db = db;

    // ---------- Reads ----------

    public async Task<IReadOnlyList<CommercialPlanResponse>> GetAllAsync(
        CommercialPlanFilter filter, CancellationToken ct = default)
    {
        var q = _db.CommercialPlans
            .AsNoTracking()
            .Include(p => p.SelectedBuyer)
            .Include(p => p.ApprovalActions)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(filter.Status)
            && Enum.TryParse<CommercialPlanStatus>(filter.Status, true, out var status))
        {
            q = q.Where(p => p.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(filter.RecommendedRoute)
            && Enum.TryParse<CommercialRoute>(filter.RecommendedRoute, true, out var route))
        {
            q = q.Where(p => p.RecommendedRoute == route);
        }

        var plans = await q
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync(ct);

        return plans.Select(Map).ToList();
    }

    public async Task<CommercialPlanResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var plan = await _db.CommercialPlans
            .AsNoTracking()
            .Include(p => p.SelectedBuyer)
            .Include(p => p.ApprovalActions)
            .FirstOrDefaultAsync(p => p.CommercialPlanId == id, ct)
            ?? throw new KeyNotFoundException($"Commercial plan {id} not found.");

        // Resolve performer names for the timeline
        var performerIds = plan.ApprovalActions.Select(a => a.PerformedByUserId).Distinct().ToList();
        var names = await _db.Users
            .Where(u => performerIds.Contains(u.UserId))
            .ToDictionaryAsync(u => u.UserId, u => u.FullName, ct);

        var response = Map(plan);
        foreach (var action in response.ApprovalActions)
        {
            action.PerformedByName = names.TryGetValue(action.PerformedByUserId, out var n) ? n : "Unknown";
        }
        return response;
    }

    // ---------- Writes ----------

    public async Task<CommercialPlanResponse> CreateAsync(
        CreateCommercialPlanRequest request, Guid systemUserId, CancellationToken ct = default)
    {
        var route = Enum.Parse<CommercialRoute>(request.RecommendedRoute, true);

        // Validate selected buyer if provided
        if (request.SelectedBuyerId.HasValue)
        {
            var exists = await _db.Buyers.AnyAsync(b => b.BuyerId == request.SelectedBuyerId.Value, ct);
            if (!exists)
                throw new InvalidOperationException("Selected buyer does not exist.");
        }

        var plan = new CommercialPlan
        {
            WorkflowId = request.WorkflowId,
            RecommendedRoute = route,
            SelectedBuyerId = request.SelectedBuyerId,
            DestinationCountry = request.DestinationCountry?.Trim(),
            MaterialsJson = request.MaterialsJson,
            ExpectedRevenue = request.ExpectedRevenue,
            EstimatedCosts = request.EstimatedCosts,
            EstimatedNetValue = request.EstimatedNetValue,
            ReasoningSummary = request.ReasoningSummary.Trim(),
            ApprovalRequired = request.ApprovalRequired,
            RiskFlags = request.RiskFlags,
            Status = CommercialPlanStatus.PendingApproval
        };

        _db.CommercialPlans.Add(plan);

        // Log the submission as an audit action
        _db.ApprovalActions.Add(new ApprovalAction
        {
            CommercialPlanId = plan.CommercialPlanId,
            ActionType = ApprovalActionType.Submitted,
            PerformedByUserId = systemUserId,
            Comments = "Plan submitted by AI agent."
        });

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(plan.CommercialPlanId, ct);
    }

    public async Task<CommercialPlanResponse> DecideAsync(
        Guid id, ApprovalDecisionRequest request, Guid currentUserId, CancellationToken ct = default)
    {
        var plan = await _db.CommercialPlans.FirstOrDefaultAsync(p => p.CommercialPlanId == id, ct)
            ?? throw new KeyNotFoundException($"Commercial plan {id} not found.");

        // Only PendingApproval or RevisionRequested plans can be decided
        if (plan.Status != CommercialPlanStatus.PendingApproval
            && plan.Status != CommercialPlanStatus.RevisionRequested)
        {
            throw new InvalidOperationException(
                $"Plan is in state '{plan.Status}' and cannot be decided.");
        }

        var actionType = request.Decision switch
        {
            "Approved" => ApprovalActionType.Approved,
            "Rejected" => ApprovalActionType.Rejected,
            "RevisionRequested" => ApprovalActionType.RevisionRequested,
            _ => throw new InvalidOperationException("Unsupported decision.")
        };

        var newStatus = request.Decision switch
        {
            "Approved" => CommercialPlanStatus.Approved,
            "Rejected" => CommercialPlanStatus.Rejected,
            "RevisionRequested" => CommercialPlanStatus.RevisionRequested,
            _ => plan.Status
        };

        plan.Status = newStatus;
        plan.UpdatedAt = DateTime.UtcNow;

        _db.ApprovalActions.Add(new ApprovalAction
        {
            CommercialPlanId = plan.CommercialPlanId,
            ActionType = actionType,
            PerformedByUserId = currentUserId,
            Comments = request.Comments?.Trim()
        });

        await _db.SaveChangesAsync(ct);
        return await GetByIdAsync(plan.CommercialPlanId, ct);
    }

    public async Task<CommercialPlanResponse> MarkExecutedAsync(
        Guid id, Guid currentUserId, CancellationToken ct = default)
    {
        var plan = await _db.CommercialPlans.FirstOrDefaultAsync(p => p.CommercialPlanId == id, ct)
            ?? throw new KeyNotFoundException($"Commercial plan {id} not found.");

        if (plan.Status != CommercialPlanStatus.Approved)
            throw new InvalidOperationException("Only Approved plans can be marked as Executed.");

        plan.Status = CommercialPlanStatus.Executed;
        plan.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(plan.CommercialPlanId, ct);
    }

    // ---------- Mapping ----------

    private static CommercialPlanResponse Map(CommercialPlan p) => new()
    {
        CommercialPlanId = p.CommercialPlanId,
        WorkflowId = p.WorkflowId,
        RecommendedRoute = p.RecommendedRoute.ToString(),
        SelectedBuyerId = p.SelectedBuyerId,
        SelectedBuyerName = p.SelectedBuyer?.CompanyName,
        DestinationCountry = p.DestinationCountry,
        MaterialsJson = p.MaterialsJson,
        ExpectedRevenue = p.ExpectedRevenue,
        EstimatedCosts = p.EstimatedCosts,
        EstimatedNetValue = p.EstimatedNetValue,
        ReasoningSummary = p.ReasoningSummary,
        ApprovalRequired = p.ApprovalRequired,
        RiskFlags = p.RiskFlags,
        Status = p.Status.ToString(),
        CreatedAt = p.CreatedAt,
        UpdatedAt = p.UpdatedAt,
        ApprovalActions = p.ApprovalActions
            .OrderBy(a => a.PerformedAt)
            .Select(a => new ApprovalActionResponse
            {
                ApprovalActionId = a.ApprovalActionId,
                ActionType = a.ActionType.ToString(),
                PerformedByUserId = a.PerformedByUserId,
                PerformedByName = string.Empty,   // populated in GetById
                Comments = a.Comments,
                PerformedAt = a.PerformedAt
            })
            .ToList()
    };
}