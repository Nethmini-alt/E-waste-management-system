using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddIntakeWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "agent_execution_logs",
                columns: table => new
                {
                    log_id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    agent_name = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    step_number = table.Column<int>(type: "integer", nullable: false),
                    input_json = table.Column<string>(type: "jsonb", nullable: false),
                    output_json = table.Column<string>(type: "jsonb", nullable: true),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    succeeded = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    error_message = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_agent_execution_logs", x => x.log_id);
                });

            migrationBuilder.CreateTable(
                name: "collection_workflows",
                columns: table => new
                {
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    plan_json = table.Column<string>(type: "jsonb", nullable: true),
                    analyzer_result_json = table.Column<string>(type: "jsonb", nullable: true),
                    validator_result_json = table.Column<string>(type: "jsonb", nullable: true),
                    matcher_result_json = table.Column<string>(type: "jsonb", nullable: true),
                    final_reasoning_summary = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    approval_required = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    resulting_job_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collection_workflows", x => x.workflow_id);
                    table.CheckConstraint("CK_collection_workflows_status", "status IN ('planning','analyzing','validating','pendingapproval','matching','finalizing','completed','rejected','failed')");
                });

            migrationBuilder.CreateTable(
                name: "workflow_approval_actions",
                columns: table => new
                {
                    workflow_approval_action_id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    performed_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    comments = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    performed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_workflow_approval_actions", x => x.workflow_approval_action_id);
                    table.CheckConstraint("CK_workflow_approval_actions_type", "action_type IN ('submitted','revisionrequested','approved','rejected')");
                    table.ForeignKey(
                        name: "FK_workflow_approval_actions_collection_workflows_workflow_id",
                        column: x => x.workflow_id,
                        principalTable: "collection_workflows",
                        principalColumn: "workflow_id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_workflow_approval_actions_users_performed_by_user_id",
                        column: x => x.performed_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_agent_execution_logs_agent_name",
                table: "agent_execution_logs",
                column: "agent_name");

            migrationBuilder.CreateIndex(
                name: "IX_agent_execution_logs_workflow_id_step_number",
                table: "agent_execution_logs",
                columns: new[] { "workflow_id", "step_number" });

            migrationBuilder.CreateIndex(
                name: "IX_collection_workflows_created_at",
                table: "collection_workflows",
                column: "created_at");

            migrationBuilder.CreateIndex(
                name: "IX_collection_workflows_status",
                table: "collection_workflows",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_collection_workflows_submission_id",
                table: "collection_workflows",
                column: "submission_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_actions_performed_by_user_id",
                table: "workflow_approval_actions",
                column: "performed_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_approval_actions_workflow_id_performed_at",
                table: "workflow_approval_actions",
                columns: new[] { "workflow_id", "performed_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "agent_execution_logs");

            migrationBuilder.DropTable(
                name: "workflow_approval_actions");

            migrationBuilder.DropTable(
                name: "collection_workflows");
        }
    }
}
