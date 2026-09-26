using EWasteManagement.API.Features.Collection.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class JobAssignmentHistoryConfiguration : IEntityTypeConfiguration<JobAssignmentHistory>
{
    public void Configure(EntityTypeBuilder<JobAssignmentHistory> builder)
    {
        builder.ToTable("job_assignment_history", t =>
        {
            t.HasCheckConstraint("CK_job_assignment_history_outcome", "outcome IN ('assigned','accepted','rejected')");
        });

        builder.HasKey(h => h.HistoryId);
        builder.Property(h => h.HistoryId).HasColumnName("history_id");

        builder.Property(h => h.JobId).HasColumnName("job_id").IsRequired();
        builder.HasIndex(h => h.JobId);

        builder.Property(h => h.CollectorId).HasColumnName("collector_id").IsRequired();
        builder.HasIndex(h => h.CollectorId);

        builder.Property(h => h.Outcome)
            .HasColumnName("outcome")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<AssignmentOutcome>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(h => h.Reason).HasColumnName("reason").HasMaxLength(500);

        builder.Property(h => h.Timestamp)
            .HasColumnName("timestamp")
            .HasDefaultValueSql("now()");

        // The reassignment query filters "which collectors already saw this job",
        // so this composite index is the one that actually gets used at runtime.
        builder.HasIndex(h => new { h.JobId, h.CollectorId });
    }
}
