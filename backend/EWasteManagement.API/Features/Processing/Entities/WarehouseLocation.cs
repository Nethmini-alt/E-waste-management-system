using EWasteManagement.API.Shared.Common;

namespace EWasteManagement.API.Features.Processing.Entities;

public class WarehouseLocation : BaseEntity
{
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
}
