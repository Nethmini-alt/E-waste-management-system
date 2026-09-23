using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class ExportOrderItemConfiguration : IEntityTypeConfiguration<ExportOrderItem>
{
    public void Configure(EntityTypeBuilder<ExportOrderItem> builder)
    {
        builder.ToTable("export_order_items", t =>
        {
            t.HasCheckConstraint("CK_export_order_items_qty", "quantity_kg > 0");
            t.HasCheckConstraint("CK_export_order_items_price", "unit_price >= 0");
            t.HasCheckConstraint("CK_export_order_items_total", "line_total >= 0");
        });

        builder.HasKey(i => i.ExportOrderItemId);
        builder.Property(i => i.ExportOrderItemId).HasColumnName("export_order_item_id");

        builder.Property(i => i.ExportOrderId).HasColumnName("export_order_id").IsRequired();
        builder.Property(i => i.RecoveredMaterialId).HasColumnName("recovered_material_id").IsRequired();

        builder.Property(i => i.MaterialType)
            .HasColumnName("material_type").HasMaxLength(100).IsRequired();

        builder.Property(i => i.QuantityKg)
            .HasColumnName("quantity_kg").HasPrecision(12, 2).IsRequired();

        builder.Property(i => i.UnitPrice)
            .HasColumnName("unit_price").HasPrecision(12, 2).IsRequired();

        builder.Property(i => i.LineTotal)
            .HasColumnName("line_total").HasPrecision(14, 2).IsRequired();

        builder.HasOne(i => i.ExportOrder)
            .WithMany(o => o.Items)
            .HasForeignKey(i => i.ExportOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(i => i.RecoveredMaterialId);
    }
}