using EWasteManagement.API.Features.Auth.Entities;
using EWasteManagement.API.Shared.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("users", t =>
        {
            t.HasCheckConstraint(
                "CK_users_role",
                "role IN ('household','corporate','collector','staff','admin')");
            t.HasCheckConstraint(
                "CK_users_staff_type",
                "(role = 'staff' AND staff_type IN ('management','worker')) OR (role <> 'staff' AND staff_type IS NULL)");
        });

        builder.HasKey(u => u.UserId);
        builder.Property(u => u.UserId).HasColumnName("user_id");

        builder.Property(u => u.Email)
            .HasColumnName("email")
            .HasMaxLength(255)
            .IsRequired();
        builder.HasIndex(u => u.Email).IsUnique();

        builder.Property(u => u.PasswordHash)
            .HasColumnName("password_hash")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(u => u.Phone)
            .HasColumnName("phone")
            .HasMaxLength(20);

        builder.Property(u => u.FullName)
            .HasColumnName("full_name")
            .HasMaxLength(150)
            .IsRequired();

        // Stored lowercase to match the CHECK constraint (e.g. "household", not "Household")
        builder.Property(u => u.Role)
            .HasColumnName("role")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<UserRole>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(u => u.StaffType)
            .HasColumnName("staff_type")
            .HasConversion(EnumStringConverter.Create<StaffType>())
            .HasMaxLength(20);

        builder.Property(u => u.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(u => u.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(u => u.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(u => u.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()");

        builder.Property(u => u.UpdatedAt)
            .HasColumnName("updated_at");

        builder.HasQueryFilter(u => !u.IsDeleted);
    }
}