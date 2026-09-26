using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class SalesOrderItemConfiguration : IEntityTypeConfiguration<SalesOrderItem>
{
    public void Configure(EntityTypeBuilder<SalesOrderItem> builder)
    {
        builder.ToTable("sales_order_items", t =>
        {
            t.HasCheckConstraint(
                "CK_sales_order_items_quantity_positive",
                "quantity_kg > 0");

            t.HasCheckConstraint(
                "CK_sales_order_items_price_non_negative",
                "unit_price >= 0");

            t.HasCheckConstraint(
                "CK_sales_order_items_total_non_negative",
                "line_total >= 0");
        });

        builder.HasKey(i => i.SalesOrderItemId);
        builder.Property(i => i.SalesOrderItemId).HasColumnName("sales_order_item_id");

        builder.Property(i => i.SalesOrderId).HasColumnName("sales_order_id").IsRequired();

        builder.Property(i => i.RecoveredMaterialId)
            .HasColumnName("recovered_material_id")
            .IsRequired();

        builder.Property(i => i.MaterialType)
            .HasColumnName("material_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(i => i.QuantityKg)
            .HasColumnName("quantity_kg")
            .HasPrecision(12, 2)
            .IsRequired();

        builder.Property(i => i.UnitPrice)
            .HasColumnName("unit_price")
            .HasPrecision(12, 2)
            .IsRequired();

        builder.Property(i => i.LineTotal)
            .HasColumnName("line_total")
            .HasPrecision(14, 2)
            .IsRequired();

        // Cascade: delete items when order is deleted
        builder.HasOne(i => i.SalesOrder)
            .WithMany(o => o.Items)
            .HasForeignKey(i => i.SalesOrderId)
            .OnDelete(DeleteBehavior.Cascade);

        // Index: find all items for a given material batch (useful for stock reconciliation)
        builder.HasIndex(i => i.RecoveredMaterialId);
    }
}