using EWasteManagement.API.Features.AgentWorkflows.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class AgentStepConfiguration : IEntityTypeConfiguration<AgentStep>
{
    public void Configure(EntityTypeBuilder<AgentStep> builder)
    {
        builder.ToTable("agent_steps", t =>
        {
            t.HasCheckConstraint("ck_agent_steps_status", "status IN ('succeeded','failed','skipped')");
        });

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");

        builder.Property(s => s.WorkflowId).HasColumnName("workflow_id").IsRequired();
        builder.Property(s => s.Revision).HasColumnName("revision");
        builder.Property(s => s.Agent).HasColumnName("agent").HasMaxLength(30).IsRequired();
        builder.Property(s => s.StepName).HasColumnName("step_name").HasMaxLength(60).IsRequired();
        builder.Property(s => s.Status).HasColumnName("status").HasMaxLength(20).IsRequired();
        builder.Property(s => s.StartedAt).HasColumnName("started_at");
        builder.Property(s => s.DurationMs).HasColumnName("duration_ms");
        builder.Property(s => s.Retries).HasColumnName("retries");
        builder.Property(s => s.Error).HasColumnName("error").HasMaxLength(1000);

        builder.Property(s => s.InputSummary).HasColumnName("input_summary").HasColumnType("jsonb");
        builder.Property(s => s.Output).HasColumnName("output").HasColumnType("jsonb");
        builder.Property(s => s.Checks).HasColumnName("checks").HasColumnType("jsonb");
        builder.Property(s => s.ToolCalls).HasColumnName("tool_calls").HasColumnType("jsonb");

        // The agent service retries reports, so the same step can arrive twice. A step is identified by
        // who ran it and when it started: a retry has the same StartedAt (=> update), while the same step
        // re-run after a revision starts later (=> a new row, so the history of earlier runs is kept).
        builder.HasIndex(s => new { s.WorkflowId, s.Agent, s.StepName, s.StartedAt })
            .IsUnique()
            .HasDatabaseName("ux_agent_steps_identity");
    }
}
