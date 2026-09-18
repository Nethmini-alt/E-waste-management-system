using EWasteManagement.API.Features.Processing.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class RatePolicyConfiguration : IEntityTypeConfiguration<RatePolicy>
{
    public void Configure(EntityTypeBuilder<RatePolicy> builder)
    {
        builder.ToTable("rate_policies");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).HasColumnName("id");
        builder.Property(x => x.CreatedAt).HasColumnName("created_at");

        builder.Property(x => x.ItemType).HasColumnName("item_type").HasMaxLength(50).IsRequired();
        builder.Property(x => x.RatePerKg).HasColumnName("rate_per_kg").HasColumnType("decimal(10,2)");
        builder.Property(x => x.IsActive).HasColumnName("is_active");
        builder.Property(x => x.EffectiveFrom).HasColumnName("effective_from");

        // One active rate per item type at a time — prevents ambiguous "which rate applies" bugs.
        builder.HasIndex(x => x.ItemType).HasFilter("is_active = true").IsUnique();
        builder.HasData(
            new RatePolicy { Id = Guid.Parse("22222222-2222-2222-2222-222222222201"), ItemType = "Laptop", RatePerKg = 50m, IsActive = true, EffectiveFrom = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc), CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) },
            new RatePolicy { Id = Guid.Parse("22222222-2222-2222-2222-222222222202"), ItemType = "Mobile Phone", RatePerKg = 80m, IsActive = true, EffectiveFrom = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc), CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) },
            new RatePolicy { Id = Guid.Parse("22222222-2222-2222-2222-222222222203"), ItemType = "Battery", RatePerKg = 30m, IsActive = true, EffectiveFrom = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc), CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) },
            new RatePolicy { Id = Guid.Parse("22222222-2222-2222-2222-222222222204"), ItemType = "General Household Electronics", RatePerKg = 40m, IsActive = true, EffectiveFrom = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc), CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) },
            new RatePolicy { Id = Guid.Parse("22222222-2222-2222-2222-222222222205"), ItemType = "GeneralCollection", RatePerKg = 20m, IsActive = true, EffectiveFrom = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc), CreatedAt = new DateTime(2026, 9, 16, 0, 0, 0, DateTimeKind.Utc) }
        );
    }
}
