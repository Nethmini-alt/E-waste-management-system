using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class BuyerConfiguration : IEntityTypeConfiguration<Buyer>
{
    public void Configure(EntityTypeBuilder<Buyer> builder)
    {
        builder.ToTable("buyers", t =>
        {
            t.HasCheckConstraint(
                "CK_buyers_type",
                "buyer_type IN ('local','export')");

            t.HasCheckConstraint(
                "CK_buyers_status",
                "status IN ('pending','active','suspended')");
        });

        builder.HasKey(b => b.BuyerId);
        builder.Property(b => b.BuyerId).HasColumnName("buyer_id");

        builder.Property(b => b.UserId).HasColumnName("user_id").IsRequired();
        builder.HasIndex(b => b.UserId).IsUnique();

        builder.Property(b => b.CompanyName)
            .HasColumnName("company_name")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(b => b.ContactPerson)
            .HasColumnName("contact_person")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(b => b.Email)
            .HasColumnName("email")
            .HasMaxLength(150)
            .IsRequired();

        builder.Property(b => b.PhoneNumber)
            .HasColumnName("phone_number")
            .HasMaxLength(30);

        builder.Property(b => b.Address)
            .HasColumnName("address");

        builder.Property(b => b.BuyerType)
            .HasColumnName("buyer_type")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<BuyerType>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(b => b.Status)
            .HasColumnName("status")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<BuyerStatus>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(b => b.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(b => b.DeletedAt).HasColumnName("deleted_at");

        builder.Property(b => b.CreatedAt)
            .HasColumnName("created_at")
            .HasDefaultValueSql("now()");

        builder.Property(b => b.UpdatedAt).HasColumnName("updated_at");

        // 1:1 with User (each buyer is one corporate user)
        builder.HasOne(b => b.User)
            .WithOne()
            .HasForeignKey<Buyer>(b => b.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(b => !b.IsDeleted);
    }
}