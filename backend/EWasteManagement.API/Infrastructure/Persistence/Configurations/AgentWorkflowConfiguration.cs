using EWasteManagement.Api.Entities;
using EWasteManagement.API.Features.AgentWorkflows.Entities;
using EWasteManagement.API.Shared.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class AgentWorkflowConfiguration : IEntityTypeConfiguration<AgentWorkflow>
{
    public void Configure(EntityTypeBuilder<AgentWorkflow> builder)
    {
        builder.ToTable("agent_workflows", t =>
        {
            t.HasCheckConstraint(
                "ck_agent_workflows_status",
                "status IN ('planning','pendingapproval','revisioninprogress','completed','rejected','needsmanualreview')");
        });

        builder.HasKey(w => w.Id);
        builder.Property(w => w.Id).HasColumnName("workflow_id");
        builder.Property(w => w.CreatedAt).HasColumnName("created_at");
        builder.Property(w => w.UpdatedAt).HasColumnName("updated_at");

        builder.Property(w => w.SubmissionId).HasColumnName("submission_id").IsRequired();
        builder.HasOne<Submission>()
            .WithMany()
            .HasForeignKey(w => w.SubmissionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.HasIndex(w => w.SubmissionId);

        builder.Property(w => w.Status)
            .HasConversion(EnumStringConverter.Create<AgentWorkflowStatus>())
            .HasColumnName("status")
            .HasMaxLength(20)
            .IsRequired();
        builder.HasIndex(w => w.Status);

        builder.Property(w => w.Outcome).HasColumnName("outcome").HasMaxLength(30);
        builder.Property(w => w.FailureReason).HasColumnName("failure_reason").HasMaxLength(1000);
        builder.Property(w => w.RevisionCount).HasColumnName("revision_count").HasDefaultValue(0);

        builder.Property(w => w.Plan).HasColumnName("plan").HasColumnType("jsonb");
        builder.Property(w => w.Analysis).HasColumnName("analysis").HasColumnType("jsonb");
        builder.Property(w => w.Validation).HasColumnName("validation").HasColumnType("jsonb");
        builder.Property(w => w.Match).HasColumnName("match").HasColumnType("jsonb");
        builder.Property(w => w.Proposal).HasColumnName("proposal").HasColumnType("jsonb");
        builder.Property(w => w.ExcludedCollectorIds).HasColumnName("excluded_collector_ids").HasColumnType("jsonb");

        builder.Property(w => w.JobId).HasColumnName("job_id");
        builder.Property(w => w.Decision).HasColumnName("decision").HasMaxLength(20);
        builder.Property(w => w.DecidedByUserId).HasColumnName("decided_by_user_id");
        builder.Property(w => w.DecisionComments).HasColumnName("decision_comments").HasMaxLength(1000);
        builder.Property(w => w.DecidedAt).HasColumnName("decided_at");

        builder.HasMany(w => w.Steps)
            .WithOne(s => s.Workflow)
            .HasForeignKey(s => s.WorkflowId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
