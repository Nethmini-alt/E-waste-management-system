using EWasteManagement.API.Features.Sales.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace EWasteManagement.API.Infrastructure.Persistence.Configurations;

public class CommercialPlanConfiguration : IEntityTypeConfiguration<CommercialPlan>
{
    public void Configure(EntityTypeBuilder<CommercialPlan> builder)
    {
        builder.ToTable("commercial_plans", t =>
        {
            t.HasCheckConstraint(
                "CK_commercial_plans_route",
                "recommended_route IN ('localsale','export')");

            t.HasCheckConstraint(
                "CK_commercial_plans_status",
                "status IN ('draft','pendingapproval','approved','rejected','revisionrequested','executed')");

            t.HasCheckConstraint(
                "CK_commercial_plans_revenue_non_negative",
                "expected_revenue >= 0");

            t.HasCheckConstraint(
                "CK_commercial_plans_costs_non_negative",
                "estimated_costs >= 0");
        });

        builder.HasKey(p => p.CommercialPlanId);
        builder.Property(p => p.CommercialPlanId).HasColumnName("commercial_plan_id");

        builder.Property(p => p.WorkflowId).HasColumnName("workflow_id").IsRequired();

        builder.Property(p => p.RecommendedRoute)
            .HasColumnName("recommended_route")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<CommercialRoute>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.SelectedBuyerId).HasColumnName("selected_buyer_id");
        builder.Property(p => p.DestinationCountry)
            .HasColumnName("destination_country").HasMaxLength(100);

        builder.Property(p => p.MaterialsJson)
            .HasColumnName("materials_json")
            .HasColumnType("jsonb")
            .IsRequired();

        builder.Property(p => p.ExpectedRevenue)
            .HasColumnName("expected_revenue").HasPrecision(14, 2).IsRequired();

        builder.Property(p => p.EstimatedCosts)
            .HasColumnName("estimated_costs").HasPrecision(14, 2).IsRequired();

        builder.Property(p => p.EstimatedNetValue)
            .HasColumnName("estimated_net_value").HasPrecision(14, 2).IsRequired();

        builder.Property(p => p.ReasoningSummary)
            .HasColumnName("reasoning_summary").HasMaxLength(2000).IsRequired();

        builder.Property(p => p.ApprovalRequired)
            .HasColumnName("approval_required").HasDefaultValue(true);

        builder.Property(p => p.RiskFlags)
            .HasColumnName("risk_flags")
            .HasColumnType("jsonb");

        builder.Property(p => p.Status)
            .HasColumnName("status")
            .HasConversion(
                v => v.ToString().ToLower(),
                v => Enum.Parse<CommercialPlanStatus>(v, true))
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at").HasDefaultValueSql("now()");

        builder.Property(p => p.UpdatedAt).HasColumnName("updated_at");

        // FK to Buyer (nullable — plans may not select a buyer)
        builder.HasOne(p => p.SelectedBuyer)
            .WithMany()
            .HasForeignKey(p => p.SelectedBuyerId)
            .OnDelete(DeleteBehavior.SetNull);

        // Indexes
        builder.HasIndex(p => p.Status);
        builder.HasIndex(p => p.WorkflowId);
        builder.HasIndex(p => p.CreatedAt);
    }
}