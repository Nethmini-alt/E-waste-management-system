using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Shared.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class ClassificationRecordConfiguration : IEntityTypeConfiguration<ClassificationRecord>
{
    public void Configure(EntityTypeBuilder<ClassificationRecord> builder)
    {
        builder.ToTable("classification_records", t =>
        {
            t.HasCheckConstraint(
                "ck_classification_records_category",
                "category IN ('reusable','localrecyclable','hazardous','exportonly')");
            t.HasCheckConstraint(
                "ck_classification_records_source",
                "source IN ('manual','ai')");
        });

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");

        builder.Property(x => x.InventoryItemId).HasColumnName("inventory_item_id").IsRequired();

        builder.Property(x => x.Category)
            .HasConversion(EnumStringConverter.Create<ClassificationCategory>())
            .HasColumnName("category").HasMaxLength(20).IsRequired();

        builder.Property(x => x.Source)
            .HasConversion(EnumStringConverter.Create<ClassificationSource>())
            .HasColumnName("source").HasMaxLength(10).IsRequired();

        builder.Property(x => x.SubCategory).HasColumnName("sub_category").HasMaxLength(100);
        builder.Property(x => x.ConfidenceScore).HasColumnName("confidence_score").HasColumnType("decimal(4,3)");
        builder.Property(x => x.ClassifiedByStaffId).HasColumnName("classified_by_staff_id");
        builder.Property(x => x.IsFinal).HasColumnName("is_final");
        builder.Property(x => x.OverriddenByStaffId).HasColumnName("overridden_by_staff_id");
        builder.Property(x => x.OverrideReason).HasColumnName("override_reason").HasMaxLength(500);
        builder.Property(x => x.ClassifiedAt).HasColumnName("classified_at");

        builder.HasOne(x => x.InventoryItem)
            .WithMany()
            .HasForeignKey(x => x.InventoryItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
