using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCollectionTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_jobs_status",
                table: "jobs");

            migrationBuilder.AddCheckConstraint(
                name: "CK_jobs_status",
                table: "jobs",
                sql: "status IN ('assigned','accepted','rejected','inprogress','completed','cancelled','nocollectoravailable','pickuplocationunresolved')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_jobs_status",
                table: "jobs");

            migrationBuilder.AddCheckConstraint(
                name: "CK_jobs_status",
                table: "jobs",
                sql: "status IN ('assigned','accepted','rejected','inprogress','completed','cancelled','nocollectoravailable')");
        }
    }
}
