using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.ExternalServices;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Services;

public interface ISalesOrderService
{
    Task<IReadOnlyList<SalesOrderResponse>> GetAllAsync(SalesOrderFilter filter, CancellationToken ct = default);
    Task<SalesOrderResponse> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<SalesOrderResponse> CreateAsync(CreateSalesOrderRequest request, Guid currentUserId, CancellationToken ct = default);
    Task<SalesOrderResponse> UpdateStatusAsync(Guid id, UpdateSalesOrderStatusRequest request, CancellationToken ct = default);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}

public class SalesOrderService : ISalesOrderService
{
    private readonly ApplicationDbContext _db;
    private readonly IRecoveredMaterialsProvider _materials;

    public SalesOrderService(ApplicationDbContext db, IRecoveredMaterialsProvider materials)
    {
        _db = db;
        _materials = materials;
    }

    // ---------- Reads ----------

    public async Task<IReadOnlyList<SalesOrderResponse>> GetAllAsync(
        SalesOrderFilter filter, CancellationToken ct = default)
    {
        var q = _db.SalesOrders
            .AsNoTracking()
            .Include(o => o.Buyer)
            .Include(o => o.Items)
            .AsQueryable();

        if (filter.BuyerId.HasValue)
            q = q.Where(o => o.BuyerId == filter.BuyerId.Value);

        if (!string.IsNullOrWhiteSpace(filter.Status)
            && Enum.TryParse<SalesOrderStatus>(filter.Status, true, out var status))
        {
            q = q.Where(o => o.Status == status);
        }

        return await q
            .OrderByDescending(o => o.OrderDate)
            .Select(o => Map(o))
            .ToListAsync(ct);
    }

    public async Task<SalesOrderResponse> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _db.SalesOrders
            .AsNoTracking()
            .Include(o => o.Buyer)
            .Include(o => o.Items)
            .FirstOrDefaultAsync(o => o.SalesOrderId == id, ct)
            ?? throw new KeyNotFoundException($"Sales order {id} not found.");
        return Map(order);
    }

    // ---------- Writes ----------

    public async Task<SalesOrderResponse> CreateAsync(
        CreateSalesOrderRequest request, Guid currentUserId, CancellationToken ct = default)
    {
        // 1. Buyer must exist and be Active
        var buyer = await _db.Buyers.FirstOrDefaultAsync(b => b.BuyerId == request.BuyerId, ct)
            ?? throw new InvalidOperationException("Buyer does not exist.");

        if (buyer.Status != BuyerStatus.Active)
            throw new InvalidOperationException("Buyer is not active and cannot place orders.");

        // 2. Reject duplicate material lines within the same order
        var duplicate = request.Items
            .GroupBy(i => i.RecoveredMaterialId)
            .FirstOrDefault(g => g.Count() > 1);
        if (duplicate != null)
            throw new InvalidOperationException(
                $"Material appears more than once in the order. Combine quantities into a single line.");

        // 3. Build items by validating each against Component C's provider + current pricing
        var items = new List<SalesOrderItem>();
        var total = 0m;

        foreach (var line in request.Items)
        {
            // 3a. Material must exist
            var material = await _materials.GetByIdAsync(line.RecoveredMaterialId, ct)
                ?? throw new InvalidOperationException(
                    $"Recovered material {line.RecoveredMaterialId} not found.");

            // 3b. Must be sellable
            if (material.ProcessingStatus != "Ready" || !material.SafetyValidated)
                throw new InvalidOperationException(
                    $"Material batch {material.MaterialType} is not sellable (status: {material.ProcessingStatus}).");

            // 3c. Quantity available
            if (line.QuantityKg > material.QuantityKg)
                throw new InvalidOperationException(
                    $"Requested {line.QuantityKg}kg of {material.MaterialType}, " +
                    $"but only {material.QuantityKg}kg available.");

            // 3d. Current approved price
            var price = await _db.MaterialPricings
                .Where(p => p.MaterialType == material.MaterialType
                            && p.Status == PricingStatus.Approved)
                .OrderByDescending(p => p.EffectiveDate)
                .FirstOrDefaultAsync(ct)
                ?? throw new InvalidOperationException(
                    $"No approved price found for '{material.MaterialType}'. Set a price first.");

            // 3e. Compute line total
            var lineTotal = Math.Round(line.QuantityKg * price.PricePerKg, 2);
            total += lineTotal;

            items.Add(new SalesOrderItem
            {
                RecoveredMaterialId = material.RecoveredMaterialId,
                MaterialType = material.MaterialType,
                QuantityKg = line.QuantityKg,
                UnitPrice = price.PricePerKg,
                LineTotal = lineTotal
            });
        }

        // 4. Create the order
        var order = new SalesOrder
        {
            BuyerId = buyer.BuyerId,
            OrderDate = DateTime.UtcNow,
            TotalAmount = total,
            Status = SalesOrderStatus.Draft,
            Notes = request.Notes?.Trim(),
            CreatedByUserId = currentUserId,
            Items = items
        };

        _db.SalesOrders.Add(order);
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(order.SalesOrderId, ct);
    }

    public async Task<SalesOrderResponse> UpdateStatusAsync(
        Guid id, UpdateSalesOrderStatusRequest request, CancellationToken ct = default)
    {
        var order = await _db.SalesOrders.FirstOrDefaultAsync(o => o.SalesOrderId == id, ct)
            ?? throw new KeyNotFoundException($"Sales order {id} not found.");

        var newStatus = Enum.Parse<SalesOrderStatus>(request.Status, true);

        // Business rules for state transitions
        if (order.Status == SalesOrderStatus.Completed && newStatus != SalesOrderStatus.Completed)
            throw new InvalidOperationException("Completed orders cannot be reopened.");

        if (order.Status == SalesOrderStatus.Cancelled && newStatus != SalesOrderStatus.Cancelled)
            throw new InvalidOperationException("Cancelled orders cannot be reopened.");

        if (order.Status == SalesOrderStatus.Draft && newStatus == SalesOrderStatus.Completed)
            throw new InvalidOperationException("Draft orders must be Confirmed before they can be Completed.");

        order.Status = newStatus;
        order.UpdatedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync(ct);

        return await GetByIdAsync(order.SalesOrderId, ct);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var order = await _db.SalesOrders.FirstOrDefaultAsync(o => o.SalesOrderId == id, ct)
            ?? throw new KeyNotFoundException($"Sales order {id} not found.");

        // Only Draft orders can be deleted. Others must be Cancelled.
        if (order.Status != SalesOrderStatus.Draft)
            throw new InvalidOperationException(
                "Only Draft orders can be deleted. Cancel the order instead.");

        _db.SalesOrders.Remove(order);   // cascade removes items
        await _db.SaveChangesAsync(ct);
    }

    // ---------- Mapping ----------

    private static SalesOrderResponse Map(SalesOrder o) => new()
    {
        SalesOrderId = o.SalesOrderId,
        BuyerId = o.BuyerId,
        BuyerCompanyName = o.Buyer?.CompanyName ?? string.Empty,
        OrderDate = o.OrderDate,
        TotalAmount = o.TotalAmount,
        Status = o.Status.ToString(),
        Notes = o.Notes,
        CreatedByUserId = o.CreatedByUserId,
        CreatedAt = o.CreatedAt,
        UpdatedAt = o.UpdatedAt,
        Items = o.Items.Select(i => new SalesOrderItemResponse
        {
            SalesOrderItemId = i.SalesOrderItemId,
            RecoveredMaterialId = i.RecoveredMaterialId,
            MaterialType = i.MaterialType,
            QuantityKg = i.QuantityKg,
            UnitPrice = i.UnitPrice,
            LineTotal = i.LineTotal
        }).ToList()
    };
}