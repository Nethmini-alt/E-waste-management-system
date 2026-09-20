using EWasteManagement.API.Features.Processing.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class WarehouseLocationConfiguration : IEntityTypeConfiguration<WarehouseLocation>
{
    public void Configure(EntityTypeBuilder<WarehouseLocation> builder)
    {
        builder.ToTable("warehouse_locations");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");

        builder.Property(x => x.Name).HasColumnName("name").HasMaxLength(100).IsRequired();
        builder.Property(x => x.Description).HasColumnName("description").HasMaxLength(500);
        builder.HasData(
            new WarehouseLocation { Id = Guid.Parse("11111111-1111-1111-1111-111111111101"), Name = "Receiving Bay", Description = "Where collector deliveries and extra-waste drop-offs are first received and weighed.", CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) },
            new WarehouseLocation { Id = Guid.Parse("11111111-1111-1111-1111-111111111102"), Name = "Sorting Area", Description = "Items are sorted by category before dismantling or direct classification.", CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) },
            new WarehouseLocation { Id = Guid.Parse("11111111-1111-1111-1111-111111111103"), Name = "Dismantling Area", Description = "Items are broken down into separately trackable child components.", CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) },
            new WarehouseLocation { Id = Guid.Parse("11111111-1111-1111-1111-111111111104"), Name = "Ready-for-Sale Storage", Description = "Classified items awaiting handoff to Component D.", CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) }
        );
    }
}
