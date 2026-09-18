using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class ExportOrderConfiguration : IEntityTypeConfiguration<ExportOrder>
{
    public void Configure(EntityTypeBuilder<ExportOrder> builder)
    {
        builder.ToTable("export_orders", t =>
        {
            t.HasCheckConstraint(
                "CK_export_orders_status",
                "status IN ('draft','pendingapproval','approved','shipped','completed','cancelled')");

            t.HasCheckConstraint(
                "CK_export_orders_weight_non_negative",
                "total_weight_kg >= 0");

            t.HasCheckConstraint(
                "CK_export_orders_value_non_negative",
                "total_value >= 0");
        });

        builder.HasKey(o => o.ExportOrderId);
        builder.Property(o => o.ExportOrderId).HasColumnName("export_order_id");

        builder.Property(o => o.BuyerId).HasColumnName("buyer_id").IsRequired();

        builder.Property(o => o.OrderDate)
            .HasColumnName("order_date")
            .HasDefaultValueSql("now()");

        builder.Property(o => o.DestinationCountry)
            .HasColumnName("destination_country")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(o => o.ShipmentDate)
            .HasColumnName("shipment_date")
            .IsRequired();

        builder.Property(o => o.TotalWeightKg)
            .HasColumnName("total_weight_kg")
            .HasPrecision(12, 2)
            .IsRequired();

        builder.Property(o => o.TotalValue)
            .HasColumnName("total_value")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(o => o.Status)
            .HasColumnName("status")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<ExportOrderStatus>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(o => o.Notes).HasColumnName("notes");

        builder.Property(o => o.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()");

        builder.Property(o => o.UpdatedAt).HasColumnName("updated_at");

        builder.Property(o => o.CreatedByUserId)
            .HasColumnName("created_by_user_id")
            .IsRequired();

        builder.HasOne(o => o.Buyer)
            .WithMany(b => b.ExportOrders)
            .HasForeignKey(o => o.BuyerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<EWasteManagement.API.Features.Auth.Entities.User>()
            .WithMany()
            .HasForeignKey(o => o.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(o => new { o.Status, o.OrderDate });
        builder.HasIndex(o => o.BuyerId);
        builder.HasIndex(o => o.DestinationCountry);
    }
}