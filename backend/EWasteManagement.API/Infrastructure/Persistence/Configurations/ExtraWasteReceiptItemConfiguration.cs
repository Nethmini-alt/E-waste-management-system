using EWasteManagement.API.Features.Processing.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class ExtraWasteReceiptItemConfiguration : IEntityTypeConfiguration<ExtraWasteReceiptItem>
{
    public void Configure(EntityTypeBuilder<ExtraWasteReceiptItem> builder)
    {
        builder.ToTable("extra_waste_receipt_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");

        builder.Property(x => x.ExtraWasteReceiptId).HasColumnName("extra_waste_receipt_id").IsRequired();
        builder.Property(x => x.ItemType).HasColumnName("item_type").HasMaxLength(50).IsRequired();
        builder.Property(x => x.Accepted).HasColumnName("accepted");
        builder.Property(x => x.RejectionReason).HasColumnName("rejection_reason").HasMaxLength(500);
        builder.Property(x => x.InventoryItemId).HasColumnName("inventory_item_id");

        builder.HasOne(x => x.InventoryItem)
            .WithMany()
            .HasForeignKey(x => x.InventoryItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
