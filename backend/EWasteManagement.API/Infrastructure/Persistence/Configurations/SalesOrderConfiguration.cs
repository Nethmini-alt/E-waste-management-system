using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class SalesOrderConfiguration : IEntityTypeConfiguration<SalesOrder>
{
    public void Configure(EntityTypeBuilder<SalesOrder> builder)
    {
        builder.ToTable("sales_orders", t =>
        {
            t.HasCheckConstraint(
                "CK_sales_orders_status",
                "status IN ('draft','confirmed','completed','cancelled')");

            t.HasCheckConstraint(
                "CK_sales_orders_total_non_negative",
                "total_amount >= 0");
        });

        builder.HasKey(o => o.SalesOrderId);
        builder.Property(o => o.SalesOrderId).HasColumnName("sales_order_id");

        builder.Property(o => o.BuyerId).HasColumnName("buyer_id").IsRequired();

        builder.Property(o => o.OrderDate)
            .HasColumnName("order_date")
            .HasDefaultValueSql("now()");

        builder.Property(o => o.TotalAmount)
            .HasColumnName("total_amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(o => o.Status)
            .HasColumnName("status")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<SalesOrderStatus>(v, true))
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

        // FK to Buyer (restrict — don't delete a buyer with orders)
        builder.HasOne(o => o.Buyer)
            .WithMany(b => b.SalesOrders)
            .HasForeignKey(o => o.BuyerId)
            .OnDelete(DeleteBehavior.Restrict);

        // FK to User (restrict — audit trail)
        builder.HasOne<EWasteManagement.API.Features.Auth.Entities.User>()
            .WithMany()
            .HasForeignKey(o => o.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Index for revenue reports
        builder.HasIndex(o => new { o.Status, o.OrderDate });
        builder.HasIndex(o => o.BuyerId);
    }
}