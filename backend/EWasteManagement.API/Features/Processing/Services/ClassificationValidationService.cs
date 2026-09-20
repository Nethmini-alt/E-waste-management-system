using EWasteManagement.API.Features.Processing.DTOs;
using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EWasteManagement.API.Features.Processing.Services;

public class ClassificationValidationService : IClassificationValidationService
{
    private static readonly string[] HazardKeywords = { "battery", "crt", "mercury", "lithium", "lead", "cfc" };
    private const decimal LowConfidenceThreshold = 0.7m;

    private readonly ApplicationDbContext _db;
    public ClassificationValidationService(ApplicationDbContext db) => _db = db;

    public async Task<ValidateClassificationResponse> ValidateAsync(
        Guid inventoryItemId, ValidateClassificationRequest request, CancellationToken cancellationToken = default)
    {
        var reasons = new List<string>();
        var item = await _db.InventoryItems.AsNoTracking().FirstOrDefaultAsync(i => i.Id == inventoryItemId, cancellationToken);

        if (item is null)
            return new ValidateClassificationResponse { Approved = false, Reasons = { "Inventory item not found." } };

        if (item.Status != InventoryStatus.Sorting && item.Status != InventoryStatus.Dismantling)
            return new ValidateClassificationResponse { Approved = false, Reasons = { $"Item is in status '{item.Status}', not eligible for classification." } };

        if (request.ProposedSubCategory?.Length > 100)
            return new ValidateClassificationResponse { Approved = false, Reasons = { "Sub-category exceeds the maximum allowed length." } };

        var requiresHumanReview = false;

        var looksHazardousByName = HazardKeywords.Any(k => item.ItemType.Contains(k, StringComparison.OrdinalIgnoreCase));
        if (looksHazardousByName && request.ProposedCategory != ClassificationCategory.Hazardous)
        {
            requiresHumanReview = true;
            reasons.Add($"Item type '{item.ItemType}' matches a known hazardous-material keyword but wasn't classified Hazardous.");
        }

        if (request.ConfidenceScore.HasValue && request.ConfidenceScore.Value < LowConfidenceThreshold)
        {
            requiresHumanReview = true;
            reasons.Add($"Confidence {request.ConfidenceScore:F2} is below the {LowConfidenceThreshold:F2} auto-approval threshold.");
        }

        if (reasons.Count == 0)
            reasons.Add("Passed all deterministic checks.");

        return new ValidateClassificationResponse { Approved = true, RequiresHumanReview = requiresHumanReview, Reasons = reasons };
    }
}