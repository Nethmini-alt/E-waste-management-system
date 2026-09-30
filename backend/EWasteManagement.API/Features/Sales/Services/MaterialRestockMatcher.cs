using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace EWasteManagement.API.Features.Sales.Services;

public interface IMaterialRestockMatcher
{
    Task MatchInventoryAsync(Guid inventoryItemId, CancellationToken ct = default);
    Task RecheckWaitingRequestsAsync(CancellationToken ct = default);
}

public class MaterialRestockMatcher : IMaterialRestockMatcher
{
    private readonly ApplicationDbContext _db;
    private readonly IRecoveredMaterialsProvider _materials;
    private readonly IAgentClient _agent;
    private readonly ILogger<MaterialRestockMatcher> _logger;

    public MaterialRestockMatcher(
        ApplicationDbContext db,
        IRecoveredMaterialsProvider materials,
        IAgentClient agent,
        ILogger<MaterialRestockMatcher> logger)
    {
        _db = db;
        _materials = materials;
        _agent = agent;
        _logger = logger;
    }

    public async Task RecheckWaitingRequestsAsync(CancellationToken ct = default)
    {
        await EnsureBackordersExistAsync(ct);
        var readyInventoryIds = await _db.InventoryItems.AsNoTracking()
            .Where(item => item.Status == InventoryStatus.ReadyForSale)
            .OrderBy(item => item.CreatedAt)
            .Select(item => item.Id)
            .ToListAsync(ct);

        foreach (var inventoryItemId in readyInventoryIds)
            await MatchInventoryAsync(inventoryItemId, ct);
    }

    public async Task MatchInventoryAsync(Guid inventoryItemId, CancellationToken ct = default)
    {
        await EnsureBackordersExistAsync(ct);
        var inventory = await _db.InventoryItems.AsNoTracking()
            .FirstOrDefaultAsync(item => item.Id == inventoryItemId, ct);
        if (inventory is null || inventory.Status != InventoryStatus.ReadyForSale)
            return;

        var waiting = await _db.MaterialRequests
            .Include(request => request.Buyer)
            .Include(request => request.SalesOrder)
                .ThenInclude(order => order!.Items)
                .Where(request => (request.Status == MaterialRequestStatus.Waiting
                    || request.Status == MaterialRequestStatus.WaitingForPrice
                    || request.Status == MaterialRequestStatus.PlanGenerationFailed)
                && request.MaterialType.ToLower() == inventory.ItemType.ToLower()
                && request.Buyer.Status == BuyerStatus.Active)
            .OrderBy(request => request.CreatedAt)
            .ToListAsync(ct);

        if (waiting.Count == 0)
            return;

        var availableMaterials = await _materials.GetAvailableAsync(ct);
        var availableKg = availableMaterials
            .Where(material => string.Equals(material.MaterialType, inventory.ItemType, StringComparison.OrdinalIgnoreCase))
            .Sum(material => material.QuantityKg);

        var existingReservations = await _db.MaterialRequests.AsNoTracking()
            .Where(request => request.MaterialType.ToLower() == inventory.ItemType.ToLower()
                && request.Status == MaterialRequestStatus.GeneratingPlan)
            .Select(request => request.QuantityKg)
            .ToListAsync(ct);
        var reservedKg = existingReservations.Sum();

        var availableCapacityKg = availableKg - reservedKg;
        if (availableCapacityKg <= 0)
            return;

        var rankingPrice = await _db.MaterialPricings
            .CurrentForAsync(inventory.ItemType, MaterialPricingPolicy.Today, ct);
        if (rankingPrice is null)
        {
            var changed = false;
            foreach (var request in waiting.Where(request => request.QuantityKg <= availableCapacityKg
                && (request.Buyer.BuyerType != BuyerType.Export || request.QuantityKg >= 20m)))
            {
                request.Status = MaterialRequestStatus.WaitingForPrice;
                request.LastMatchingNote = $"No live approved price for {inventory.ItemType}; matching will retry after pricing is approved.";
                request.UpdatedAt = DateTime.UtcNow;
                if (request.SalesOrder is not null)
                {
                    request.SalesOrder.Status = SalesOrderStatus.WaitingForPrice;
                    request.SalesOrder.UpdatedAt = DateTime.UtcNow;
                }
                changed = true;
            }

            if (changed)
                await _db.SaveChangesAsync(ct);
            return;
        }

        waiting = waiting
            .Where(request => request.Buyer.BuyerType != BuyerType.Export || request.QuantityKg >= 20m)
            .ToList();

        // "Who gets served first?" is the Sales agent's call now: it ranks these
        // competitors with its own priority tools (agentic-ai/Sales/graph/priority.py) and
        // returns the order plus the reasons. This backend used to decide that itself, by
        // sorting on expected net value — a revenue-first rule with no explanation.
        //
        // The sort below is kept as the OFFLINE FALLBACK: allocation must not stall, and
        // must not silently change, just because the Python service is unreachable.
        var agentOrder = await TryGetAgentPriorityAsync(
            waiting, inventory.ItemType, availableKg - reservedKg, rankingPrice.PricePerKg, ct);

        waiting = agentOrder is null
            ? waiting
                .OrderByDescending(request => EstimateNetValue(request, rankingPrice.PricePerKg))
                .ThenByDescending(request => EstimateNetValue(request, rankingPrice.PricePerKg) / request.QuantityKg)
                .ThenBy(request => request.CreatedAt)
                .ToList()
            : waiting
                .OrderBy(request => agentOrder.TryGetValue(request.MaterialRequestId, out var rank)
                    ? rank
                    : int.MaxValue)
                .ThenBy(request => request.CreatedAt)
                .ToList();

        foreach (var request in waiting)
        {
            if (request.QuantityKg > availableKg - reservedKg)
                continue;

            var claimed = await _db.MaterialRequests
                .Where(row => row.MaterialRequestId == request.MaterialRequestId
                    && (row.Status == MaterialRequestStatus.Waiting
                        || row.Status == MaterialRequestStatus.WaitingForPrice
                        || row.Status == MaterialRequestStatus.PlanGenerationFailed))
                .ExecuteUpdateAsync(update => update
                    .SetProperty(row => row.Status, MaterialRequestStatus.GeneratingPlan)
                    .SetProperty(row => row.UpdatedAt, DateTime.UtcNow), ct);
            if (claimed == 0)
                continue;

            request.Status = MaterialRequestStatus.GeneratingPlan;
            reservedKg += request.QuantityKg;
            CommercialPlan? plan = null;
            try
            {
                var planId = await _agent.RunAgentAsync(new AgentRunGoal
                {
                    TargetBuyerId = request.BuyerId,
                    TargetMaterialTypes = new List<string> { request.MaterialType },
                    MaxQuantityKg = request.QuantityKg,
                    PreferredRoute = request.Buyer.BuyerType == BuyerType.Export ? "Export" : "LocalSale"
                }, ct);

                plan = await _db.CommercialPlans.FirstOrDefaultAsync(row => row.CommercialPlanId == planId, ct);
                if (plan is null)
                    throw new InvalidOperationException($"Sales agent returned unknown plan id {planId}.");

                if (!PlanCoversRequest(plan, request))
                {
                    plan.Status = CommercialPlanStatus.Rejected;
                    plan.UpdatedAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync(ct);
                    throw new InvalidOperationException(
                        $"Sales agent plan {planId} does not cover material request {request.MaterialRequestId}.");
                }

                var order = request.SalesOrder
                    ?? throw new InvalidOperationException("Material request has no linked backorder sales order.");
                var planLines = ParsePlanLines(plan);
                var orderItems = new List<SalesOrderItem>();
                var total = 0m;

                foreach (var line in planLines)
                {
                    if (!Guid.TryParse(line.RecoveredMaterialId, out var recoveredMaterialId)
                        || line.QuantityKg <= 0
                        || !string.Equals(line.MaterialType, request.MaterialType, StringComparison.OrdinalIgnoreCase))
                    {
                        throw new InvalidOperationException("Sales agent plan contains an invalid material line.");
                    }

                    var material = await _materials.GetByIdAsync(recoveredMaterialId, ct);
                    if (material is null || material.ProcessingStatus != "Ready" || !material.SafetyValidated
                        || line.QuantityKg > material.QuantityKg)
                    {
                        throw new InvalidOperationException(
                            $"Planned inventory batch {recoveredMaterialId} is no longer available.");
                    }

                    var price = await _db.MaterialPricings
                        .CurrentForAsync(material.MaterialType, MaterialPricingPolicy.Today, ct)
                        ?? throw new InvalidOperationException($"No current approved price for '{material.MaterialType}'.");

                    var lineTotal = Math.Round(line.QuantityKg * price.PricePerKg, 2);
                    total += lineTotal;
                    orderItems.Add(new SalesOrderItem
                    {
                        RecoveredMaterialId = recoveredMaterialId,
                        MaterialType = material.MaterialType,
                        QuantityKg = line.QuantityKg,
                        UnitPrice = price.PricePerKg,
                        LineTotal = lineTotal
                    });
                }

                _db.SalesOrderItems.RemoveRange(order.Items);
                foreach (var item in orderItems)
                {
                    item.SalesOrderId = order.SalesOrderId;
                    _db.SalesOrderItems.Add(item);
                }
                order.TotalAmount = total;
                order.Status = SalesOrderStatus.PendingPlanApproval;
                order.PendingMaterialType = null;
                order.PendingQuantityKg = null;
                order.UpdatedAt = DateTime.UtcNow;

                request.Status = MaterialRequestStatus.PlanGenerated;
                request.CommercialPlanId = planId;
                request.LastMatchingNote = null;
                request.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                reservedKg -= request.QuantityKg;
                if (plan?.Status == CommercialPlanStatus.PendingApproval)
                    plan.Status = CommercialPlanStatus.Rejected;
                request.Status = MaterialRequestStatus.PlanGenerationFailed;
                request.LastMatchingNote = ex.Message.Length <= 500 ? ex.Message : ex.Message[..500];
                request.UpdatedAt = DateTime.UtcNow;
                if (request.SalesOrder is not null)
                {
                    request.SalesOrder.Status = SalesOrderStatus.WaitingForStock;
                    request.SalesOrder.UpdatedAt = DateTime.UtcNow;
                }
                try
                {
                    await _db.SaveChangesAsync(CancellationToken.None);
                }
                catch (Exception saveEx)
                {
                    _logger.LogError(saveEx, "Failed to record plan generation failure for request {RequestId}", request.MaterialRequestId);
                }
                _logger.LogError(ex, "Plan generation failed for material request {RequestId}; it will be retried", request.MaterialRequestId);
            }
        }
    }

    /// <summary>
    /// Asks the Sales agent to rank the requests competing for this material. Returns null
    /// when the agent has no opinion or cannot be reached, so the caller can fall back to
    /// its own deterministic ordering.
    /// </summary>
    private async Task<Dictionary<Guid, int>?> TryGetAgentPriorityAsync(
        List<MaterialRequest> candidates,
        string materialType,
        decimal capacityKg,
        decimal pricePerKg,
        CancellationToken ct)
    {
        // A single candidate is already an answer, and a matching cycle is the wrong place
        // to spend a model call — skip the round trip entirely.
        if (candidates.Count <= 1)
            return null;

        var now = DateTime.UtcNow;
        try
        {
            var result = await _agent.PrioritizeDemandAsync(new DemandPriorityGoal
            {
                MaterialType = materialType,
                CapacityKg = capacityKg,
                Candidates = candidates.Select(request => new DemandPriorityCandidate
                {
                    MaterialRequestId = request.MaterialRequestId,
                    BuyerId = request.BuyerId,
                    BuyerType = request.Buyer.BuyerType.ToString(),
                    QuantityKg = request.QuantityKg,
                    PricePerKg = pricePerKg,
                    CreatedAt = request.CreatedAt,
                    WaitingHours = Math.Round((now - request.CreatedAt).TotalHours, 2)
                }).ToList()
            }, ct);

            if (result is null || result.RankedMaterialRequestIds.Count == 0)
            {
                _logger.LogInformation(
                    "Sales agent had no priority order for {MaterialType}; using the deterministic net-value order.",
                    materialType);
                return null;
            }

            _logger.LogInformation(
                "Sales agent prioritised {Count} competing {MaterialType} request(s) as '{Strategy}': {Reason}",
                result.RankedMaterialRequestIds.Count, materialType, result.Strategy, result.StrategyReason);

            // Ranks are de-duplicated defensively: a repeated id must not shift the queue.
            return result.RankedMaterialRequestIds
                .Select((id, index) => (Id: id, Index: index))
                .GroupBy(pair => pair.Id)
                .ToDictionary(group => group.Key, group => group.Min(pair => pair.Index));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex,
                "Sales agent priority call failed for {MaterialType}; using the deterministic net-value order.",
                materialType);
            return null;
        }
    }

    private static decimal EstimateNetValue(MaterialRequest request, decimal pricePerKg)
    {
        var costRate = request.Buyer.BuyerType == BuyerType.Export ? 0.12m : 0.05m;
        return Math.Round(request.QuantityKg * pricePerKg * (1m - costRate), 2);
    }

    private async Task EnsureBackordersExistAsync(CancellationToken ct)
    {
        var openRequests = await _db.MaterialRequests
            .Include(request => request.Buyer)
            .Include(request => request.SalesOrder)
            .Where(request => request.Status == MaterialRequestStatus.Waiting
                || request.Status == MaterialRequestStatus.WaitingForPrice
                || request.Status == MaterialRequestStatus.GeneratingPlan
                || request.Status == MaterialRequestStatus.PlanGenerationFailed)
            .ToListAsync(ct);

        var changed = false;
        foreach (var request in openRequests)
        {
            if (request.Status == MaterialRequestStatus.GeneratingPlan)
            {
                request.Status = MaterialRequestStatus.PlanGenerationFailed;
                request.LastMatchingNote = "Previous plan generation was interrupted; retrying.";
                request.UpdatedAt = DateTime.UtcNow;
                changed = true;
            }

            if (request.SalesOrder is not null)
                continue;

            request.SalesOrder = new SalesOrder
            {
                BuyerId = request.BuyerId,
                MaterialRequest = request,
                PendingMaterialType = request.MaterialType,
                PendingQuantityKg = request.QuantityKg,
                Status = request.Status == MaterialRequestStatus.WaitingForPrice
                    ? SalesOrderStatus.WaitingForPrice
                    : SalesOrderStatus.WaitingForStock,
                CreatedByUserId = request.Buyer.UserId,
                Notes = "Backorder created from buyer material request."
            };
            _db.SalesOrders.Add(request.SalesOrder);
            changed = true;
        }

        if (changed)
            await _db.SaveChangesAsync(ct);
    }

    private static List<PlannedMaterialLine> ParsePlanLines(CommercialPlan plan)
    {
        try
        {
            return JsonSerializer.Deserialize<List<PlannedMaterialLine>>(
                plan.MaterialsJson, new JsonSerializerOptions(JsonSerializerDefaults.Web)) ?? new();
        }
        catch (JsonException)
        {
            return new();
        }
    }

    private static bool PlanCoversRequest(CommercialPlan plan, MaterialRequest request)
    {
        if (plan.SelectedBuyerId != request.BuyerId)
            return false;

        try
        {
            using var document = JsonDocument.Parse(plan.MaterialsJson);
            if (document.RootElement.ValueKind != JsonValueKind.Array)
                return false;

            var plannedKg = document.RootElement.EnumerateArray()
                .Where(item => item.TryGetProperty("materialType", out var type)
                    && string.Equals(type.GetString(), request.MaterialType, StringComparison.OrdinalIgnoreCase))
                .Sum(item => item.TryGetProperty("quantityKg", out var quantity) && quantity.TryGetDecimal(out var value)
                    ? value
                    : 0m);

            return plannedKg >= request.QuantityKg;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private sealed class PlannedMaterialLine
    {
        [JsonPropertyName("recoveredMaterialId")]
        public string RecoveredMaterialId { get; set; } = string.Empty;

        [JsonPropertyName("materialType")]
        public string MaterialType { get; set; } = string.Empty;

        [JsonPropertyName("quantityKg")]
        public decimal QuantityKg { get; set; }
    }
}