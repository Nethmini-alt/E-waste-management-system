using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddComponentD_CommercialPlans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "commercial_plans",
                columns: table => new
                {
                    commercial_plan_id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recommended_route = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    selected_buyer_id = table.Column<Guid>(type: "uuid", nullable: true),
                    destination_country = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    materials_json = table.Column<string>(type: "jsonb", nullable: false),
                    expected_revenue = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    estimated_costs = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    estimated_net_value = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    reasoning_summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    approval_required = table.Column<bool>(type: "boolean", nullable: false, defaultValue: true),
                    risk_flags = table.Column<string>(type: "jsonb", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commercial_plans", x => x.commercial_plan_id);
                    table.CheckConstraint("CK_commercial_plans_costs_non_negative", "estimated_costs >= 0");
                    table.CheckConstraint("CK_commercial_plans_revenue_non_negative", "expected_revenue >= 0");
                    table.CheckConstraint("CK_commercial_plans_route", "recommended_route IN ('localsale','export')");
                    table.CheckConstraint("CK_commercial_plans_status", "status IN ('draft','pendingapproval','approved','rejected','revisionrequested','executed')");
                    table.ForeignKey(
                        name: "FK_commercial_plans_buyers_selected_buyer_id",
                        column: x => x.selected_buyer_id,
                        principalTable: "buyers",
                        principalColumn: "buyer_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "approval_actions",
                columns: table => new
                {
                    approval_action_id = table.Column<Guid>(type: "uuid", nullable: false),
                    commercial_plan_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    performed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    comments = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    performed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_approval_actions", x => x.approval_action_id);
                    table.CheckConstraint("CK_approval_actions_type", "action_type IN ('submitted','revisionrequested','approved','rejected')");
                    table.ForeignKey(
                        name: "FK_approval_actions_commercial_plans_commercial_plan_id",
                        column: x => x.commercial_plan_id,
                        principalTable: "commercial_plans",
                        principalColumn: "commercial_plan_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_approval_actions_users_performed_by_user_id",
                        column: x => x.performed_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_approval_actions_commercial_plan_id_performed_at",
                table: "approval_actions",
                columns: new[] { "commercial_plan_id", "performed_at" });

            migrationBuilder.CreateIndex(
                name: "IX_approval_actions_performed_by_user_id",
                table: "approval_actions",
                column: "performed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_commercial_plans_created_at",
                table: "commercial_plans",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_commercial_plans_selected_buyer_id",
                table: "commercial_plans",
                column: "selected_buyer_id");

            migrationBuilder.CreateIndex(
                name: "IX_commercial_plans_status",
                table: "commercial_plans",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_commercial_plans_workflow_id",
                table: "commercial_plans",
                column: "workflow_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "approval_actions");

            migrationBuilder.DropTable(
                name: "commercial_plans");
        }
    }
}
