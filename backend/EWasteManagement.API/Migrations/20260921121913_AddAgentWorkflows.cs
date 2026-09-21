using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAgentWorkflows : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "agent_workflows",
                columns: table => new
                {
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    outcome = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    failure_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    revision_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0),
                    plan = table.Column<string>(type: "jsonb", nullable: true),
                    analysis = table.Column<string>(type: "jsonb", nullable: true),
                    validation = table.Column<string>(type: "jsonb", nullable: true),
                    match = table.Column<string>(type: "jsonb", nullable: true),
                    proposal = table.Column<string>(type: "jsonb", nullable: true),
                    excluded_collector_ids = table.Column<string>(type: "jsonb", nullable: true),
                    job_id = table.Column<Guid>(type: "uuid", nullable: true),
                    decision = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    decided_by_user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    decision_comments = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    decided_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_agent_workflows", x => x.workflow_id);
                    table.CheckConstraint("ck_agent_workflows_status", "status IN ('planning','pendingapproval','revisioninprogress','completed','rejected','needsmanualreview')");
                    table.ForeignKey(
                        name: "FK_agent_workflows_Submissions_submission_id",
                        column: x => x.submission_id,
                        principalTable: "Submissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "agent_steps",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    workflow_id = table.Column<Guid>(type: "uuid", nullable: false),
                    revision = table.Column<int>(type: "integer", nullable: false),
                    agent = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    step_name = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    started_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    duration_ms = table.Column<int>(type: "integer", nullable: false),
                    retries = table.Column<int>(type: "integer", nullable: false),
                    error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    input_summary = table.Column<string>(type: "jsonb", nullable: true),
                    output = table.Column<string>(type: "jsonb", nullable: true),
                    checks = table.Column<string>(type: "jsonb", nullable: true),
                    tool_calls = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_agent_steps", x => x.id);
                    table.CheckConstraint("ck_agent_steps_status", "status IN ('succeeded','failed','skipped')");
                    table.ForeignKey(
                        name: "FK_agent_steps_agent_workflows_workflow_id",
                        column: x => x.workflow_id,
                        principalTable: "agent_workflows",
                        principalColumn: "workflow_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_agent_steps_identity",
                table: "agent_steps",
                columns: new[] { "workflow_id", "agent", "step_name", "started_at" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_agent_workflows_status",
                table: "agent_workflows",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_agent_workflows_submission_id",
                table: "agent_workflows",
                column: "submission_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "agent_steps");

            migrationBuilder.DropTable(
                name: "agent_workflows");
        }
    }
}
