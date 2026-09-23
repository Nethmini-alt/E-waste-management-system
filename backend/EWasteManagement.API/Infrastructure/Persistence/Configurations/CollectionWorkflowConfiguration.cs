using EWasteManagement.API.Features.Workflow.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class CollectionWorkflowConfiguration : IEntityTypeConfiguration<CollectionWorkflow>
{
    public void Configure(EntityTypeBuilder<CollectionWorkflow> builder)
    {
        builder.ToTable("collection_workflows", t =>
        {
            t.HasCheckConstraint(
                "CK_collection_workflows_status",
                "status IN ('planning','analyzing','validating','pendingapproval','matching','finalizing','completed','rejected','failed')");
        });

        builder.HasKey(w => w.WorkflowId);
        builder.Property(w => w.WorkflowId).HasColumnName("workflow_id");

        builder.Property(w => w.SubmissionId).HasColumnName("submission_id").IsRequired();

        builder.Property(w => w.Status)
            .HasColumnName("status")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<WorkflowStatus>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(w => w.PlanJson)
            .HasColumnName("plan_json").HasColumnType("jsonb");

        builder.Property(w => w.AnalyzerResultJson)
            .HasColumnName("analyzer_result_json").HasColumnType("jsonb");

        builder.Property(w => w.ValidatorResultJson)
            .HasColumnName("validator_result_json").HasColumnType("jsonb");

        builder.Property(w => w.MatcherResultJson)
            .HasColumnName("matcher_result_json").HasColumnType("jsonb");

        builder.Property(w => w.FinalReasoningSummary)
            .HasColumnName("final_reasoning_summary").HasMaxLength(2000);

        builder.Property(w => w.ApprovalRequired)
            .HasColumnName("approval_required").HasDefaultValue(false);

        builder.Property(w => w.ResultingJobId).HasColumnName("resulting_job_id");

        builder.Property(w => w.CreatedAt)
            .HasColumnName("created_at").HasDefaultValueSql("now()");

        builder.Property(w => w.UpdatedAt).HasColumnName("updated_at");
        builder.Property(w => w.CompletedAt).HasColumnName("completed_at");

        // No FK on SubmissionId / ResultingJobId — deliberately loose, matching the
        // convention Job.cs already established for its own SubmissionId field
        // (see that file's comment): features don't take hard dependencies on
        // each other's entities just to reference an id.

        builder.HasIndex(w => w.Status);
        builder.HasIndex(w => w.SubmissionId);
        builder.HasIndex(w => w.CreatedAt);
    }
}