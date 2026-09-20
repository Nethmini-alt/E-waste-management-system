using EWasteManagement.API.Features.Processing.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class ExtraWasteReceiptConfiguration : IEntityTypeConfiguration<ExtraWasteReceipt>
{
    public void Configure(EntityTypeBuilder<ExtraWasteReceipt> builder)
    {
        builder.ToTable("extra_waste_receipts");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");

        builder.Property(x => x.CollectorId).HasColumnName("collector_id").IsRequired();
        builder.Property(x => x.ReceivedByStaffId).HasColumnName("received_by_staff_id").IsRequired();
        builder.Property(x => x.ReceivedAt).HasColumnName("received_at");
        builder.Property(x => x.Notes).HasColumnName("notes").HasMaxLength(1000);
        builder.Property(x => x.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(100);
        // Lets the client safely retry a double-tap without creating a duplicate receipt.
        builder.HasIndex(x => x.IdempotencyKey).IsUnique().HasFilter("idempotency_key IS NOT NULL");

        builder.HasMany(x => x.Items)
            .WithOne(x => x.ExtraWasteReceipt)
            .HasForeignKey(x => x.ExtraWasteReceiptId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
