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

        foreach (var request in waiting)
        {
            if (request.QuantityKg > availableKg - reservedKg)
                continue;

            var claimed = await _db.MaterialRequests
                .Where(row => row.MaterialRequestId == request.MaterialRequestId
                    && (row.Status == MaterialRequestStatus.Waiting
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
                request.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                reservedKg -= request.QuantityKg;
                if (plan?.Status == CommercialPlanStatus.PendingApproval)
                    plan.Status = CommercialPlanStatus.Rejected;
                request.Status = MaterialRequestStatus.PlanGenerationFailed;
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

    private async Task EnsureBackordersExistAsync(CancellationToken ct)
    {
        var openRequests = await _db.MaterialRequests
            .Include(request => request.Buyer)
            .Include(request => request.SalesOrder)
            .Where(request => request.Status == MaterialRequestStatus.Waiting
                || request.Status == MaterialRequestStatus.GeneratingPlan
                || request.Status == MaterialRequestStatus.PlanGenerationFailed)
            .ToListAsync(ct);

        var changed = false;
        foreach (var request in openRequests)
        {
            if (request.Status == MaterialRequestStatus.GeneratingPlan)
            {
                request.Status = MaterialRequestStatus.PlanGenerationFailed;
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
                Status = SalesOrderStatus.WaitingForStock,
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