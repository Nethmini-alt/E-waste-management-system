using EWasteManagement.API.Features.Collection.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class JobConfiguration : IEntityTypeConfiguration<Job>
{
    public void Configure(EntityTypeBuilder<Job> builder)
    {
        builder.ToTable("jobs", t =>
        {
            t.HasCheckConstraint(
                "CK_jobs_status",
                "status IN ('assigned','accepted','rejected','inprogress','completed','cancelled','nocollectoravailable','pickuplocationunresolved')");
        });

        builder.HasKey(j => j.JobId);
        builder.Property(j => j.JobId).HasColumnName("job_id");

        builder.Property(j => j.SubmissionId).HasColumnName("submission_id").IsRequired();
        builder.HasIndex(j => j.SubmissionId);

        builder.Property(j => j.CollectorId).HasColumnName("collector_id");
        builder.HasOne(j => j.CollectorEntity)
            .WithMany()
            .HasForeignKey(j => j.CollectorId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(j => j.Status)
            .HasColumnName("status")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<JobStatus>(v, true))
            .HasMaxLength(30)
            .IsRequired();
        builder.HasIndex(j => j.Status);

        builder.Property(j => j.PickupAddress)
            .HasColumnName("pickup_address")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(j => j.PickupLatitude)
            .HasColumnName("pickup_latitude")
            .HasColumnType("numeric(9,6)");

        builder.Property(j => j.PickupLongitude)
            .HasColumnName("pickup_longitude")
            .HasColumnType("numeric(9,6)");

        builder.Property(j => j.ScheduledWindowStart).HasColumnName("scheduled_window_start");
        builder.Property(j => j.ScheduledWindowEnd).HasColumnName("scheduled_window_end");
        builder.Property(j => j.EstimatedEtaMinutes).HasColumnName("estimated_eta_minutes");

        builder.Property(j => j.EstimatedDistanceKm)
            .HasColumnName("estimated_distance_km")
            .HasColumnType("numeric(8,2)");

        builder.Property(j => j.PhotoUrl).HasColumnName("photo_url");

        builder.Property(j => j.MeasuredWeightKg)
            .HasColumnName("measured_weight_kg")
            .HasColumnType("numeric(10,2)");

        builder.Property(j => j.Notes).HasColumnName("notes");
        builder.Property(j => j.RejectionReason).HasColumnName("rejection_reason").HasMaxLength(500);

        builder.Property(j => j.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()");

        builder.Property(j => j.RespondedAt).HasColumnName("responded_at");
        builder.Property(j => j.CompletedAt).HasColumnName("completed_at");
    }
}
