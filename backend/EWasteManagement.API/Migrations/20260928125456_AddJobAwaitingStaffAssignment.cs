using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddJobAwaitingStaffAssignment : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_jobs_status",
                table: "jobs");

            migrationBuilder.AddColumn<string>(
                name: "matcher_reasoning",
                table: "jobs",
                type: "text",
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_jobs_status",
                table: "jobs",
                sql: "status IN ('assigned','accepted','rejected','inprogress','completed','cancelled','nocollectoravailable','pickuplocationunresolved','awaitingstaffassignment')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_jobs_status",
                table: "jobs");

            migrationBuilder.DropColumn(
                name: "matcher_reasoning",
                table: "jobs");

            migrationBuilder.AddCheckConstraint(
                name: "CK_jobs_status",
                table: "jobs",
                sql: "status IN ('assigned','accepted','rejected','inprogress','completed','cancelled','nocollectoravailable','pickuplocationunresolved')");
        }
    }
}
