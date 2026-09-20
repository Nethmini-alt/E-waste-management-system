using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "collectors",
                columns: table => new
                {
                    collector_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    vehicle_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    capacity_kg = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    current_latitude = table.Column<decimal>(type: "numeric(9,6)", nullable: true),
                    current_longitude = table.Column<decimal>(type: "numeric(9,6)", nullable: true),
                    location_updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    is_available = table.Column<bool>(type: "boolean", nullable: false, defaultValue: false),
                    rating = table.Column<decimal>(type: "numeric(3,2)", nullable: false, defaultValue: 5.0m),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collectors", x => x.collector_id);
                    table.ForeignKey(
                        name: "FK_collectors_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "job_assignment_history",
                columns: table => new
                {
                    history_id = table.Column<Guid>(type: "uuid", nullable: false),
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collector_id = table.Column<Guid>(type: "uuid", nullable: false),
                    outcome = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    timestamp = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_job_assignment_history", x => x.history_id);
                    table.CheckConstraint("CK_job_assignment_history_outcome", "outcome IN ('assigned','accepted','rejected')");
                });

            migrationBuilder.CreateTable(
                name: "jobs",
                columns: table => new
                {
                    job_id = table.Column<Guid>(type: "uuid", nullable: false),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collector_id = table.Column<Guid>(type: "uuid", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    pickup_address = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    pickup_latitude = table.Column<decimal>(type: "numeric(9,6)", nullable: true),
                    pickup_longitude = table.Column<decimal>(type: "numeric(9,6)", nullable: true),
                    scheduled_window_start = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    scheduled_window_end = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    estimated_eta_minutes = table.Column<int>(type: "integer", nullable: true),
                    estimated_distance_km = table.Column<decimal>(type: "numeric(8,2)", nullable: true),
                    photo_url = table.Column<string>(type: "text", nullable: true),
                    measured_weight_kg = table.Column<decimal>(type: "numeric(10,2)", nullable: true),
                    notes = table.Column<string>(type: "text", nullable: true),
                    rejection_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    responded_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_jobs", x => x.job_id);
                    table.CheckConstraint("CK_jobs_status", "status IN ('assigned','accepted','rejected','inprogress','completed','cancelled','nocollectoravailable')");
                    table.ForeignKey(
                        name: "FK_jobs_collectors_collector_id",
                        column: x => x.collector_id,
                        principalTable: "collectors",
                        principalColumn: "collector_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_collectors_is_available",
                table: "collectors",
                column: "is_available");

            migrationBuilder.CreateIndex(
                name: "IX_collectors_user_id",
                table: "collectors",
                column: "user_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_job_assignment_history_collector_id",
                table: "job_assignment_history",
                column: "collector_id");

            migrationBuilder.CreateIndex(
                name: "IX_job_assignment_history_job_id",
                table: "job_assignment_history",
                column: "job_id");

            migrationBuilder.CreateIndex(
                name: "IX_job_assignment_history_job_id_collector_id",
                table: "job_assignment_history",
                columns: new[] { "job_id", "collector_id" });

            migrationBuilder.CreateIndex(
                name: "IX_jobs_collector_id",
                table: "jobs",
                column: "collector_id");

            migrationBuilder.CreateIndex(
                name: "IX_jobs_status",
                table: "jobs",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "IX_jobs_submission_id",
                table: "jobs",
                column: "submission_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "job_assignment_history");

            migrationBuilder.DropTable(
                name: "jobs");

            migrationBuilder.DropTable(
                name: "collectors");
        }
    }
}
