using EWasteManagement.API.Features.Processing.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class ProcessingLogConfiguration : IEntityTypeConfiguration<ProcessingLog>
{
    public void Configure(EntityTypeBuilder<ProcessingLog> builder)
    {
        builder.ToTable("processing_logs");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");

        builder.Property(x => x.InventoryItemId).HasColumnName("inventory_item_id").IsRequired();
        builder.Property(x => x.Action).HasColumnName("action").HasMaxLength(50).IsRequired();
        builder.Property(x => x.PerformedByStaffId).HasColumnName("performed_by_staff_id").IsRequired();
        builder.Property(x => x.PerformedAt).HasColumnName("performed_at");
        builder.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(1000);

        builder.HasOne(x => x.InventoryItem)
            .WithMany()
            .HasForeignKey(x => x.InventoryItemId)
            .OnDelete(DeleteBehavior.Restrict); // logs must outlive normal item operations
    }
}
