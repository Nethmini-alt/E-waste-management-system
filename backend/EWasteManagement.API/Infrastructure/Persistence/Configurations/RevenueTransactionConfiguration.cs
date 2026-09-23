using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class RevenueTransactionConfiguration : IEntityTypeConfiguration<RevenueTransaction>
{
    public void Configure(EntityTypeBuilder<RevenueTransaction> builder)
    {
        builder.ToTable("revenue_transactions", t =>
        {
            t.HasCheckConstraint(
                "CK_revenue_transactions_type",
                "transaction_type IN ('localsale','export')");

            t.HasCheckConstraint(
                "CK_revenue_transactions_amount_positive",
                "amount > 0");
        });

        builder.HasKey(r => r.RevenueId);
        builder.Property(r => r.RevenueId).HasColumnName("revenue_id");

        builder.Property(r => r.TransactionType)
            .HasColumnName("transaction_type")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<RevenueType>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(r => r.ReferenceId)
            .HasColumnName("reference_id")
            .IsRequired();

        builder.Property(r => r.Amount)
            .HasColumnName("amount")
            .HasPrecision(14, 2)
            .IsRequired();

        builder.Property(r => r.TransactionDate)
            .HasColumnName("transaction_date")
            .HasDefaultValueSql("now()");

        builder.Property(r => r.Remarks)
            .HasColumnName("remarks")
            .HasMaxLength(500);

        builder.Property(r => r.RecordedByUserId)
            .HasColumnName("recorded_by_user_id")
            .IsRequired();

        // FK to users (audit — cannot delete a user who recorded revenue)
        builder.HasOne(r => r.RecordedByUser) 
        .WithMany()
        .HasForeignKey(r => r.RecordedByUserId)
        .OnDelete(DeleteBehavior.Restrict);

        // Idempotency: only ONE revenue row per (type, reference)
        builder.HasIndex(r => new { r.TransactionType, r.ReferenceId })
            .IsUnique();

        // Fast lookups by date for reporting
        builder.HasIndex(r => r.TransactionDate);
    }
}