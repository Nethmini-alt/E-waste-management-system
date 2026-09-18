using EWasteManagement.API.Features.Sales.DTOs;

namespace EWasteManagement.API.Infrastructure.ExternalServices;

/// <summary>
/// TEMPORARY stub implementation. Returns deterministic in-memory data so Component D
/// can be developed and tested before Component C's recovered_materials table exists.
///
/// Swap with EfRecoveredMaterialsProvider (or HttpRecoveredMaterialsProvider) later
/// by changing the DI registration in Program.cs.
/// </summary>
public class StubRecoveredMaterialsProvider : IRecoveredMaterialsProvider
{
    // Deterministic GUIDs so tests and frontend can rely on stable ids during dev.
    private static readonly Guid CopperA = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid AluminiumA = Guid.Parse("22222222-2222-2222-2222-222222222222");
    private static readonly Guid GoldA = Guid.Parse("33333333-3333-3333-3333-333333333333");
    private static readonly Guid PcbA = Guid.Parse("44444444-4444-4444-4444-444444444444");
    private static readonly Guid CopperB = Guid.Parse("55555555-5555-5555-5555-555555555555");
    private static readonly Guid PlasticA = Guid.Parse("66666666-6666-6666-6666-666666666666");

    private static readonly IReadOnlyList<RecoveredMaterialResponse> Data = new List<RecoveredMaterialResponse>
    {
        new()
        {
            RecoveredMaterialId = CopperA,
            MaterialType = "Copper",
            QuantityKg = 120.5m,
            QualityGrade = "A",
            ProcessingStatus = "Ready",
            SafetyValidated = true,
            AvailableAt = DateTime.UtcNow.AddDays(-2),
        },
        new()
        {
            RecoveredMaterialId = AluminiumA,
            MaterialType = "Aluminium",
            QuantityKg = 340.0m,
            QualityGrade = "A",
            ProcessingStatus = "Ready",
            SafetyValidated = true,
            AvailableAt = DateTime.UtcNow.AddDays(-1),
        },
        new()
        {
            RecoveredMaterialId = GoldA,
            MaterialType = "Gold",
            QuantityKg = 0.85m,
            QualityGrade = "A+",
            ProcessingStatus = "Ready",
            SafetyValidated = true,
            AvailableAt = DateTime.UtcNow.AddHours(-6),
        },
        new()
        {
            RecoveredMaterialId = PcbA,
            MaterialType = "PCB",
            QuantityKg = 75.2m,
            QualityGrade = "B",
            ProcessingStatus = "Ready",
            SafetyValidated = true,
            AvailableAt = DateTime.UtcNow.AddDays(-3),
        },
        new()
        {
            RecoveredMaterialId = CopperB,
            MaterialType = "Copper",
            QuantityKg = 50.0m,
            QualityGrade = "B",
            ProcessingStatus = "InProgress",   // not yet sellable
            SafetyValidated = false,
            AvailableAt = DateTime.UtcNow.AddDays(-1),
        },
        new()
        {
            RecoveredMaterialId = PlasticA,
            MaterialType = "Plastic",
            QuantityKg = 500.0m,
            QualityGrade = "C",
            ProcessingStatus = "Rejected",      // bad batch
            SafetyValidated = false,
            AvailableAt = DateTime.UtcNow.AddDays(-5),
        },
    };

    public Task<IReadOnlyList<RecoveredMaterialResponse>> GetAllAsync(CancellationToken ct = default)
        => Task.FromResult(Data);

    public Task<IReadOnlyList<RecoveredMaterialResponse>> GetAvailableAsync(CancellationToken ct = default)
    {
        var available = Data
            .Where(m => m.ProcessingStatus == "Ready" && m.SafetyValidated)
            .ToList();
        return Task.FromResult<IReadOnlyList<RecoveredMaterialResponse>>(available);
    }

    public Task<RecoveredMaterialResponse?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => Task.FromResult(Data.FirstOrDefault(m => m.RecoveredMaterialId == id));
}