using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class MaterialPricingConfiguration : IEntityTypeConfiguration<MaterialPricing>
{
    public void Configure(EntityTypeBuilder<MaterialPricing> builder)
    {
        builder.ToTable("material_pricing", t =>
        {
            t.HasCheckConstraint(
                "CK_material_pricing_status",
                "status IN ('draft','approved','expired')");

            t.HasCheckConstraint(
                "CK_material_pricing_price_positive",
                "price_per_kg > 0");

            // If expiry is set, it must be after effective date
            t.HasCheckConstraint(
                "CK_material_pricing_dates",
                "expiry_date IS NULL OR expiry_date > effective_date");
        });

        builder.HasKey(p => p.PricingId);
        builder.Property(p => p.PricingId).HasColumnName("pricing_id");

        builder.Property(p => p.MaterialType)
            .HasColumnName("material_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(p => p.PricePerKg)
            .HasColumnName("price_per_kg")
            .HasPrecision(12, 2)
            .IsRequired();

        builder.Property(p => p.EffectiveDate)
            .HasColumnName("effective_date")
            .IsRequired();

        builder.Property(p => p.ExpiryDate)
            .HasColumnName("expiry_date");

        builder.Property(p => p.Status)
            .HasColumnName("status")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<PricingStatus>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.CreatedByUserId)
            .HasColumnName("created_by_user_id")
            .IsRequired();

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()");

        builder.Property(p => p.UpdatedAt).HasColumnName("updated_at");

        // FK to users
        builder.HasOne(p => p.CreatedBy)
            .WithMany()
            .HasForeignKey(p => p.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Fast lookup: "get approved prices for Copper"
        builder.HasIndex(p => new { p.MaterialType, p.Status });

        // Prevent duplicate active price for same material+effective date
        builder.HasIndex(p => new { p.MaterialType, p.EffectiveDate })
            .IsUnique();

        // At most ONE approved price per material type. This is a *partial* (filtered)
        // unique index, so Draft and Expired rows are unaffected — you can keep any
        // number of those around as history. Enforcing it in the database (rather than
        // only in the service layer) means a race between two concurrent approvals can
        // no longer leave a material with two live prices.
        builder.HasIndex(p => p.MaterialType)
            .IsUnique()
            .HasFilter("status = 'approved'")
            .HasDatabaseName("IX_material_pricing_material_type_approved_unique");
    }
}