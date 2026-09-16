using EWasteManagement.API.Features.Processing.Entities;
using EWasteManagement.API.Shared.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class CollectorPaymentConfiguration : IEntityTypeConfiguration<CollectorPayment>
{
    public void Configure(EntityTypeBuilder<CollectorPayment> builder)
    {
        builder.ToTable("collector_payments", t =>
        {
            t.HasCheckConstraint(
                "ck_collector_payments_status",
                "status IN ('pending','paid')");
            t.HasCheckConstraint(
                "ck_collector_payments_source_type",
                "source_type IN ('job','extrawaste')");
        });

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");

        builder.Property(x => x.SourceType)
            .HasConversion(EnumStringConverter.Create<PaymentSourceType>())
            .HasColumnName("source_type").HasMaxLength(20).IsRequired();

        builder.Property(x => x.Status)
            .HasConversion(EnumStringConverter.Create<PaymentStatus>())
            .HasColumnName("status").HasMaxLength(10).IsRequired();

        builder.Property(x => x.SourceId).HasColumnName("source_id").IsRequired();
        builder.Property(x => x.CollectorId).HasColumnName("collector_id").IsRequired();
        builder.Property(x => x.Amount).HasColumnName("amount").HasColumnType("decimal(10,2)");
        builder.Property(x => x.PaidAt).HasColumnName("paid_at");

        // Enforces "one payment per source" from the final flow — no duplicate payments possible.
        builder.HasIndex(x => new { x.SourceType, x.SourceId }).IsUnique();
    }
}
