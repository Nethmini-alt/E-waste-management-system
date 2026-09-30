using EWasteManagement.API.Features.Notifications.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> builder)
    {
        builder.ToTable("notifications", table =>
        {
            table.HasCheckConstraint(
                "ck_notifications_type",
                "type IN ('info','success','warning','error')");
        });

        builder.HasKey(n => n.Id);
        builder.Property(n => n.Id).HasColumnName("notification_id");

        builder.Property(n => n.UserId).HasColumnName("user_id").IsRequired();

        builder.Property(n => n.Title).HasColumnName("title").HasMaxLength(150).IsRequired();
        builder.Property(n => n.Message).HasColumnName("message").HasMaxLength(500).IsRequired();

        builder.Property(n => n.Type)
            .HasColumnName("type")
            .HasConversion(
                v => v.ToString().ToLowerInvariant(),
                v => Enum.Parse<NotificationType>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(n => n.Link).HasColumnName("link").HasMaxLength(255);
        builder.Property(n => n.IsRead).HasColumnName("is_read").HasDefaultValue(false);
        builder.Property(n => n.ReadAt).HasColumnName("read_at");
        builder.Property(n => n.CreatedAt).HasColumnName("created_at").HasDefaultValueSql("now()");

        // Recipient lookups: newest first, unread filtered from this pair.
        builder.HasIndex(n => new { n.UserId, n.CreatedAt });
        builder.HasIndex(n => new { n.UserId, n.IsRead });

        // No inverse collection on User — notifications are owned, read and
        // (today) never listed from the account side. Restrict matches the
        // other audit-trail FKs (SalesOrder, MaterialPricing) and keeps rows
        // when an account is soft-deleted (the User query filter hides
        // deleted users but the FK row must stay, since User has no matching
        // "deleted notifications" filter to pair with).
        builder.HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}