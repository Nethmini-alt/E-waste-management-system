using EWasteManagement.API.Features.Workflow.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class WorkflowApprovalActionConfiguration : IEntityTypeConfiguration<WorkflowApprovalAction>
{
    public void Configure(EntityTypeBuilder<WorkflowApprovalAction> builder)
    {
        builder.ToTable("workflow_approval_actions", t =>
        {
            t.HasCheckConstraint(
                "CK_workflow_approval_actions_type",
                "action_type IN ('submitted','revisionrequested','approved','rejected')");
        });

        builder.HasKey(a => a.WorkflowApprovalActionId);
        builder.Property(a => a.WorkflowApprovalActionId).HasColumnName("workflow_approval_action_id");

        builder.Property(a => a.WorkflowId).HasColumnName("workflow_id").IsRequired();

        builder.Property(a => a.ActionType)
            .HasColumnName("action_type")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<WorkflowApprovalActionType>(v, true))
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(a => a.PerformedByUserId)
            .HasColumnName("performed_by_user_id").IsRequired();

        builder.Property(a => a.Comments)
            .HasColumnName("comments").HasMaxLength(1000);

        builder.Property(a => a.PerformedAt)
            .HasColumnName("performed_at").HasDefaultValueSql("now()");

        // Cascade: deleting a workflow deletes its approval actions — same rule
        // Sales applies between ApprovalAction and CommercialPlan.
        builder.HasOne(a => a.Workflow)
            .WithMany(w => w.ApprovalActions)
            .HasForeignKey(a => a.WorkflowId)
            .OnDelete(DeleteBehavior.Cascade);

        // FK to User IS real — Auth/User is treated as a shared dependency every
        // feature may reference, unlike Submission/Job which stay loose ids.
        builder.HasOne<EWasteManagement.API.Features.Auth.Entities.User>()
            .WithMany()
            .HasForeignKey(a => a.PerformedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => new { a.WorkflowId, a.PerformedAt });
    }
}