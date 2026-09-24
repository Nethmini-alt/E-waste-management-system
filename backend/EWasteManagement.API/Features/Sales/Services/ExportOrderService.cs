using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Services;

public interface IExportOrderService
{
    Task<IReadOnlyList<ExportOrderResponse>> GetAllAsync(ExportOrderFilter filter, CancellationToken ct = default);
    Task<ExportOrderResponse> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<ExportOrderResponse> CreateAsync(CreateExportOrderRequest request, Guid currentUserId, CancellationToken ct = default);
    Task<ExportOrderResponse> UpdateStatusAsync(Guid id, UpdateExportOrderStatusRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public class ExportOrderService : IExportOrderService
{
    private const decimal MinTotalWeightKg = 20m;

    private readonly ApplicationDbContext _db;
    private readonly IRecoveredMaterialsProvider _materials;
    private readonly IRevenueService _revenue;

    public ExportOrderService(ApplicationDbContext db, IRecoveredMaterialsProvider materials,IRevenueService revenue)
    {
        _db = db;
        _materials = materials;
        _revenue = revenue;
    }

    // ---------- Reads ----------

    public async Task<IReadOnlyList<ExportOrderResponse>> GetAllAsync(ExportOrderFilter filter, CancellationToken ct = default)
    {
        var q = _db.ExportOrders
            .AsNoTracking()
            .Include(o => o.Buyer)
            .Include(o => o.Items)
            .AsQueryable();

        if (filter.BuyerId.HasValue)
            q = q.Where(o => o.BuyerId == filter.BuyerId.Value);

        if (!string.IsNullOrWhiteSpace(filter.Status)
            && Enum.TryParse<ExportOrderStatus>(filter.Status, true, out var status))
        {
            q = q.Where(o => o.Status == status);
        }

        if (!string.IsNullOrWhiteSpace(filter.DestinationCountry))
            q = q.Where(o => o.DestinationCountry == filter.DestinationCountry);

        return await q
            .OrderByDescending(o => o.OrderDate)
            .Select(o => Map(o))
            .ToListAsync(ct);
    }

    public async Task<ExportOrderResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _db.ExportOrders
            .AsNoTracking()
            .Include(o => o.Buyer)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.ExportOrderId == id, ct)
            ?? throw new KeyNotFoundException($"Export order {id} not found.");
        return Map(order);
    }

    // ---------- Writes ----------

    public async Task<ExportOrderResponse> CreateAsync(
        CreateExportOrderRequest request, Guid currentUserId, CancellationToken ct = default)
    {
        // 1. Buyer must exist, be Active, AND be an Export buyer
        var buyer = await _db.Buyers.FirstOrDefaultAsync(b => b.BuyerId == request.BuyerId, ct)
            ?? throw new InvalidOperationException("Buyer does not exist.");

        if (buyer.Status != BuyerStatus.Active)
            throw new InvalidOperationException("Buyer is not active and cannot place export orders.");

        if (buyer.BuyerType != BuyerType.Export)
            throw new InvalidOperationException(
                "This buyer is registered as Local. Only Export buyers can place export orders.");

        // 2. Duplicate material lines
        var duplicate = request.Items
            .GroupBy(i => i.RecoveredMaterialId)
            .FirstOrDefault(g => g.Count() > 1);
        if (duplicate != null)
            throw new InvalidOperationException(
                "Each material can appear only once in an export order.");

        // 3. Weight rule (redundant with validator, but service-level defense)
        var totalWeight = request.Items.Sum(i => i.QuantityKg);
        if (totalWeight < MinTotalWeightKg)
            throw new InvalidOperationException(
                $"Total shipment weight must be at least {MinTotalWeightKg} kg for export.");

        // 4. Build items, snapshot prices, validate availability
        var items = new List<ExportOrderItem>();
        var totalValue = 0m;

        foreach (var line in request.Items)
        {
            var material = await _materials.GetByIdAsync(line.RecoveredMaterialId, ct)
                ?? throw new InvalidOperationException(
                    $"Recovered material {line.RecoveredMaterialId} not found.");

            if (material.ProcessingStatus != "Ready" || !material.SafetyValidated)
                throw new InvalidOperationException(
                    $"Material batch {material.MaterialType} is not sellable.");

            if (line.QuantityKg > material.QuantityKg)
                throw new InvalidOperationException(
                    $"Requested {line.QuantityKg}kg of {material.MaterialType}, " +
                    $"but only {material.QuantityKg}kg available.");

            // Current price — approved AND not past its expiry date (MaterialPricingPolicy),
            // so a dead price can never be snapshotted onto an export order line.
            var price = await _db.MaterialPricings
                .CurrentForAsync(material.MaterialType, MaterialPricingPolicy.Today, ct)
                ?? throw new InvalidOperationException(
                    $"No current price found for '{material.MaterialType}'. " +
                    "Approve a price that is effective today and has not expired.");

            var lineTotal = Math.Round(line.QuantityKg * price.PricePerKg, 2);
            totalValue += lineTotal;

            items.Add(new ExportOrderItem
            {
                RecoveredMaterialId = material.RecoveredMaterialId,
                MaterialType = material.MaterialType,
                QuantityKg = line.QuantityKg,
                UnitPrice = price.PricePerKg,
                LineTotal = lineTotal
            });
        }

        // 5. Create order (starts as Draft)
        var order = new ExportOrder
        {
            BuyerId = buyer.BuyerId,
            OrderDate = DateTime.UtcNow,
            DestinationCountry = request.DestinationCountry.Trim(),
            ShipmentDate = request.ShipmentDate,
            TotalWeightKg = totalWeight,
            TotalValue = totalValue,
            Status = ExportOrderStatus.Draft,
            Notes = request.Notes?.Trim(),
            CreatedByUserId = currentUserId,
            Items = items
        };

        _db.ExportOrders.Add(order);
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(order.ExportOrderId, ct);
    }

    public async Task<ExportOrderResponse> UpdateStatusAsync(
        Guid id, UpdateExportOrderStatusRequest request, CancellationToken ct = default)
    {
        var order = await _db.ExportOrders.FirstOrDefaultAsync(o => o.ExportOrderId == id, ct)
            ?? throw new KeyNotFoundException($"Export order {id} not found.");

        var newStatus = Enum.Parse<ExportOrderStatus>(request.Status, true);

        // Terminal states
        if (order.Status == ExportOrderStatus.Completed && newStatus != ExportOrderStatus.Completed)
            throw new InvalidOperationException("Completed export orders cannot be reopened.");

        if (order.Status == ExportOrderStatus.Cancelled && newStatus != ExportOrderStatus.Cancelled)
            throw new InvalidOperationException("Cancelled export orders cannot be reopened.");

        // Legal transitions
        var allowed = AllowedTransitions(order.Status);
        if (!allowed.Contains(newStatus))
            throw new InvalidOperationException(
                $"Cannot move from {order.Status} to {newStatus}.");

        var wasCompleted = order.Status == ExportOrderStatus.Completed;

        order.Status = newStatus;
        order.UpdatedAt = DateTime.UtcNow;

        if (!wasCompleted && newStatus == ExportOrderStatus.Completed)
        {
            await _revenue.RecordOrderRevenueAsync(
                RevenueType.Export,
                order.ExportOrderId,
                order.TotalValue,
                order.CreatedByUserId,
                remarks: $"Auto-recorded on completion of export order {order.ExportOrderId}",
                ct: ct);
        }

        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(order.ExportOrderId, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _db.ExportOrders.FirstOrDefaultAsync(o => o.ExportOrderId == id, ct)
            ?? throw new KeyNotFoundException($"Export order {id} not found.");

        if (order.Status != ExportOrderStatus.Draft)
            throw new InvalidOperationException("Only Draft export orders can be deleted. Cancel instead.");

        _db.ExportOrders.Remove(order);
        await _db.SaveChangesAsync(ct);
    }

    // ---------- Helpers ----------

    /// <summary>
    /// Legal state transitions. Exports include human-approval states (PendingApproval/Approved)
    /// per FR-D09 for high-impact actions.
    /// </summary>
    private static HashSet<ExportOrderStatus> AllowedTransitions(ExportOrderStatus current) => current switch
    {
        ExportOrderStatus.Draft => new()
        {
            ExportOrderStatus.Draft,
            ExportOrderStatus.PendingApproval,
            ExportOrderStatus.Cancelled
        },
        ExportOrderStatus.PendingApproval => new()
        {
            ExportOrderStatus.PendingApproval,
            ExportOrderStatus.Approved,
            ExportOrderStatus.Draft,
            ExportOrderStatus.Cancelled
        },
        ExportOrderStatus.Approved => new()
        {
            ExportOrderStatus.Approved,
            ExportOrderStatus.Shipped,
            ExportOrderStatus.Cancelled
        },
        ExportOrderStatus.Shipped => new()
        {
            ExportOrderStatus.Shipped,
            ExportOrderStatus.Completed
        },
        ExportOrderStatus.Completed => new() { ExportOrderStatus.Completed },
        ExportOrderStatus.Cancelled => new() { ExportOrderStatus.Cancelled },
        _ => new() { current }
    };

    private static ExportOrderResponse Map(ExportOrder o) => new()
    {
        ExportOrderId = o.ExportOrderId,
        BuyerId = o.BuyerId,
        BuyerCompanyName = o.Buyer?.CompanyName ?? string.Empty,
        OrderDate = o.OrderDate,
        DestinationCountry = o.DestinationCountry,
        ShipmentDate = o.ShipmentDate,
        TotalWeightKg = o.TotalWeightKg,
        TotalValue = o.TotalValue,
        Status = o.Status.ToString(),
        Notes = o.Notes,
        CreatedByUserId = o.CreatedByUserId,
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt,
        Items = o.Items.Select(i => new ExportOrderItemResponse
        {
            ExportOrderItemId = i.ExportOrderItemId,
            RecoveredMaterialId = i.RecoveredMaterialId,
            MaterialType = i.MaterialType,
            QuantityKg = i.QuantityKg,
            UnitPrice = i.UnitPrice,
            LineTotal = i.LineTotal
        }).ToList()
    };
}