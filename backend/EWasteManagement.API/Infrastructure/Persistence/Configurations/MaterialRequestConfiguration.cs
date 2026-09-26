using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class MaterialRequestConfiguration : IEntityTypeConfiguration<MaterialRequest>
{
    public void Configure(EntityTypeBuilder<MaterialRequest> builder)
    {
        builder.ToTable("material_requests", table =>
        {
            table.HasCheckConstraint("ck_material_requests_quantity_positive", "quantity_kg > 0");
            table.HasCheckConstraint("ck_material_requests_status", "status IN ('waiting','generatingplan','plangenerated','plangenerationfailed','orderplaced','fulfilled','cancelled')");
        });

        builder.HasKey(request => request.MaterialRequestId);
        builder.Property(request => request.MaterialRequestId).HasColumnName("material_request_id");
        builder.Property(request => request.BuyerId).HasColumnName("buyer_id").IsRequired();
        builder.Property(request => request.MaterialType).HasColumnName("material_type").HasMaxLength(100).IsRequired();
        builder.Property(request => request.QuantityKg).HasColumnName("quantity_kg").HasPrecision(12, 3).IsRequired();
        builder.Property(request => request.Status)
            .HasColumnName("status")
            .HasConversion(status => status.ToString().ToLower(), value => Enum.Parse<MaterialRequestStatus>(value, true))
            .HasMaxLength(20)
            .IsRequired();
        builder.Property(request => request.CommercialPlanId).HasColumnName("commercial_plan_id");
        builder.Property(request => request.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");
        builder.Property(request => request.UpdatedAt).HasColumnName("updated_at");

        builder.HasOne(request => request.Buyer)
            .WithMany()
            .HasForeignKey(request => request.BuyerId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne(request => request.CommercialPlan)
            .WithMany()
            .HasForeignKey(request => request.CommercialPlanId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(request => new { request.Status, request.MaterialType });
        builder.HasIndex(request => request.CommercialPlanId).IsUnique();
    }
}