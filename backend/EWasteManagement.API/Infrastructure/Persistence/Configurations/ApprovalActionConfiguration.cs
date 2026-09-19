using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class ApprovalActionConfiguration : IEntityTypeConfiguration<ApprovalAction>
{
    public void Configure(EntityTypeBuilder<ApprovalAction> builder)
    {
        builder.ToTable("approval_actions", t =>
        {
            t.HasCheckConstraint(
                "CK_approval_actions_type",
                "action_type IN ('submitted','revisionrequested','approved','rejected')");
        });

        builder.HasKey(a => a.ApprovalActionId);
        builder.Property(a => a.ApprovalActionId).HasColumnName("approval_action_id");

        builder.Property(a => a.CommercialPlanId)
            .HasColumnName("commercial_plan_id").IsRequired();

        builder.Property(a => a.ActionType)
            .HasColumnName("action_type")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<ApprovalActionType>(v, true))
            .HasMaxLength(30).IsRequired();

        builder.Property(a => a.PerformedByUserId)
            .HasColumnName("performed_by_user_id").IsRequired();

        builder.Property(a => a.Comments)
            .HasColumnName("comments").HasMaxLength(1000);

        builder.Property(a => a.PerformedAt)
            .HasColumnName("performed_at").HasDefaultValueSql("now()");

        // Cascade: deleting a plan deletes its actions
        builder.HasOne(a => a.CommercialPlan)
            .WithMany(p => p.ApprovalActions)
            .HasForeignKey(a => a.CommercialPlanId)
            .OnDelete(DeleteBehavior.Cascade);

        // FK to User (audit)
        builder.HasOne<EWasteManagement.API.Features.Auth.Entities.User>()
            .WithMany()
            .HasForeignKey(a => a.PerformedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Index for timeline queries
        builder.HasIndex(a => new { a.CommercialPlanId, a.PerformedAt });
    }
}