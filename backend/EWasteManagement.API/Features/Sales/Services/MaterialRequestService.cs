using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Features.Sales.DTOs;
using EWasteManagement.API.Features.Sales.Entities;
using EWasteManagement.API.Infrastructure.BackgroundTasks;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Sales.Services;

public interface IMaterialRequestService
{
    Task<MaterialRequestResponse> CreateAsync(Guid userId, CreateMaterialRequestRequest request, CancellationToken ct = default);
    Task<IReadOnlyList<MaterialRequestResponse>> GetMineAsync(Guid userId, CancellationToken ct = default);
    Task<IReadOnlyList<MaterialRequestResponse>> GetAllAsync(CancellationToken ct = default);
    Task CancelAsync(Guid userId, Guid requestId, CancellationToken ct = default);
}

public class MaterialRequestService : IMaterialRequestService
{
    private readonly ApplicationDbContext _db;
    private readonly IMaterialRestockQueue _queue;

    public MaterialRequestService(ApplicationDbContext db, IMaterialRestockQueue queue)
    {
        _db = db;
        _queue = queue;
    }

    public async Task<MaterialRequestResponse> CreateAsync(
        Guid userId, CreateMaterialRequestRequest request, CancellationToken ct = default)
    {
        var buyer = await _db.Buyers.FirstOrDefaultAsync(buyer => buyer.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Buyer profile not found.");

        if (buyer.Status != BuyerStatus.Active)
            throw new InvalidOperationException("Your buyer account must be active to request materials.");

        if (buyer.BuyerType == BuyerType.Export && request.QuantityKg < 20m)
            throw new InvalidOperationException("Export material requests must be at least 20 kg.");

        var materialRequest = new MaterialRequest
        {
            BuyerId = buyer.BuyerId,
            MaterialType = request.MaterialType.Trim(),
            QuantityKg = request.QuantityKg,
            Status = MaterialRequestStatus.Waiting
        };

        var order = new SalesOrder
        {
            BuyerId = buyer.BuyerId,
            MaterialRequest = materialRequest,
            PendingMaterialType = materialRequest.MaterialType,
            PendingQuantityKg = materialRequest.QuantityKg,
            Status = SalesOrderStatus.WaitingForStock,
            CreatedByUserId = userId,
            Notes = "Backorder created from buyer material request."
        };
        materialRequest.SalesOrder = order;
        _db.MaterialRequests.Add(materialRequest);
        _db.SalesOrders.Add(order);
        await _db.SaveChangesAsync(ct);

        // Queue existing matching stock too, so requests made after restock are not stranded.
        var readyInventoryIds = await _db.InventoryItems
            .Where(item => item.Status == InventoryStatus.ReadyForSale
                && item.ItemType.ToLower() == materialRequest.MaterialType.ToLower())
            .Select(item => item.Id)
            .ToListAsync(ct);
        foreach (var inventoryId in readyInventoryIds)
            _queue.Enqueue(inventoryId);

        return Map(materialRequest, buyer.CompanyName);
    }

    public async Task<IReadOnlyList<MaterialRequestResponse>> GetMineAsync(Guid userId, CancellationToken ct = default)
    {
        var buyer = await _db.Buyers.AsNoTracking().FirstOrDefaultAsync(item => item.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Buyer profile not found.");

        var requests = await _db.MaterialRequests.AsNoTracking()
            .Include(request => request.SalesOrder)
            .Where(request => request.BuyerId == buyer.BuyerId)
            .OrderByDescending(request => request.CreatedAt)
            .ToListAsync(ct);

        return requests.Select(request => Map(request, buyer.CompanyName)).ToList();
    }

    public async Task<IReadOnlyList<MaterialRequestResponse>> GetAllAsync(CancellationToken ct = default)
    {
        var requests = await _db.MaterialRequests.AsNoTracking()
            .Include(request => request.Buyer)
            .Include(request => request.SalesOrder)
            .OrderByDescending(request => request.CreatedAt)
            .ToListAsync(ct);

        return requests.Select(request => Map(request, request.Buyer.CompanyName)).ToList();
    }

    public async Task CancelAsync(Guid userId, Guid requestId, CancellationToken ct = default)
    {
        var buyer = await _db.Buyers.AsNoTracking().FirstOrDefaultAsync(item => item.UserId == userId, ct)
            ?? throw new KeyNotFoundException("Buyer profile not found.");
        var request = await _db.MaterialRequests.FirstOrDefaultAsync(
            item => item.MaterialRequestId == requestId && item.BuyerId == buyer.BuyerId, ct)
            ?? throw new KeyNotFoundException("Material request not found.");

        if (request.Status is not (MaterialRequestStatus.Waiting or MaterialRequestStatus.PlanGenerationFailed))
            throw new InvalidOperationException("Only requests waiting for stock or plan generation can be cancelled.");

        request.Status = MaterialRequestStatus.Cancelled;
        request.UpdatedAt = DateTime.UtcNow;
        var order = await _db.SalesOrders.FirstOrDefaultAsync(item => item.MaterialRequestId == requestId, ct);
        if (order is not null)
        {
            order.Status = SalesOrderStatus.Cancelled;
            order.UpdatedAt = DateTime.UtcNow;
        }
        await _db.SaveChangesAsync(ct);
    }

    private static MaterialRequestResponse Map(MaterialRequest request, string buyerName) => new()
    {
        MaterialRequestId = request.MaterialRequestId,
        BuyerId = request.BuyerId,
        BuyerCompanyName = buyerName,
        MaterialType = request.MaterialType,
        QuantityKg = request.QuantityKg,
        Status = request.Status.ToString(),
        CommercialPlanId = request.CommercialPlanId,
        SalesOrderId = request.SalesOrder?.SalesOrderId,
        CreatedAt = request.CreatedAt,
        UpdatedAt = request.UpdatedAt
    };
}