using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddJobIdUniqueIndexOnInventoryItems : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_job_id",
                table: "inventory_items",
                column: "job_id",
                unique: true,
                filter: "job_id IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_inventory_items_job_id",
                table: "inventory_items");
        }
    }
}
