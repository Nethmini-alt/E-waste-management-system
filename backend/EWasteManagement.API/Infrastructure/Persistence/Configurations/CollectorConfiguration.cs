using EWasteManagement.API.Features.Collection.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class CollectorConfiguration : IEntityTypeConfiguration<Collector>
{
    public void Configure(EntityTypeBuilder<Collector> builder)
    {
        builder.ToTable("collectors");

        builder.HasKey(c => c.CollectorId);
        builder.Property(c => c.CollectorId).HasColumnName("collector_id");

        builder.Property(c => c.UserId).HasColumnName("user_id").IsRequired();
        builder.HasIndex(c => c.UserId).IsUnique();

        // Loose FK to users — no navigation property, keeps Collection from
        // depending on Auth's entity beyond this id.
        builder.HasOne<EWasteManagement.API.Features.Auth.Entities.User>()
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Property(c => c.VehicleType)
            .HasColumnName("vehicle_type")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(c => c.CapacityKg)
            .HasColumnName("capacity_kg")
            .HasColumnType("numeric(10,2)");

        builder.Property(c => c.CurrentLatitude)
            .HasColumnName("current_latitude")
            .HasColumnType("numeric(9,6)");

        builder.Property(c => c.CurrentLongitude)
            .HasColumnName("current_longitude")
            .HasColumnType("numeric(9,6)");

        builder.Property(c => c.LocationUpdatedAt).HasColumnName("location_updated_at");

        builder.Property(c => c.IsAvailable)
            .HasColumnName("is_available")
            .HasDefaultValue(false);

        builder.Property(c => c.Rating)
            .HasColumnName("rating")
            .HasColumnType("numeric(3,2)")
            .HasDefaultValue(5.0m);

        builder.Property(c => c.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()");

        builder.Property(c => c.UpdatedAt).HasColumnName("updated_at");

        // Speeds up the "nearest available collector" scan the matcher runs.
        builder.HasIndex(c => c.IsAvailable);
    }
}
