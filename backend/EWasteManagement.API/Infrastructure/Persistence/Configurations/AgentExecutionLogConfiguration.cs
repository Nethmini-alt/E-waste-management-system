using EWasteManagement.API.Features.Workflow.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class AgentExecutionLogConfiguration : IEntityTypeConfiguration<AgentExecutionLog>
{
    public void Configure(EntityTypeBuilder<AgentExecutionLog> builder)
    {
        builder.ToTable("agent_execution_logs");

        builder.HasKey(l => l.LogId);
        builder.Property(l => l.LogId).HasColumnName("log_id");

        // Loose correlator on purpose — see the entity's doc comment. No FK
        // constraint, because it has to point at rows in either
        // collection_workflows or commercial_plans depending on which agent
        // wrote it.
        builder.Property(l => l.WorkflowId).HasColumnName("workflow_id").IsRequired();

        builder.Property(l => l.AgentName).HasColumnName("agent_name").HasMaxLength(50).IsRequired();
        builder.Property(l => l.StepNumber).HasColumnName("step_number").IsRequired();

        builder.Property(l => l.InputJson)
            .HasColumnName("input_json").HasColumnType("jsonb").IsRequired();

        builder.Property(l => l.OutputJson)
            .HasColumnName("output_json").HasColumnType("jsonb");

        builder.Property(l => l.StartedAt)
            .HasColumnName("started_at").HasDefaultValueSql("now()");

        builder.Property(l => l.CompletedAt).HasColumnName("completed_at");

        builder.Property(l => l.Succeeded)
            .HasColumnName("succeeded").HasDefaultValue(false);

        builder.Property(l => l.ErrorMessage)
            .HasColumnName("error_message").HasMaxLength(2000);

        builder.HasIndex(l => new { l.WorkflowId, l.StepNumber });
        builder.HasIndex(l => l.AgentName);
    }
}