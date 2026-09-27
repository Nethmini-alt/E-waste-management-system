using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class SeedHoldAndExportLocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "warehouse_locations",
                columns: new[] { "id", "created_at", "description", "name" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111105"), new DateTime(2026, 9, 26, 0, 0, 0, 0, DateTimeKind.Utc), "Quarantine for items on hold, including everything classified Hazardous.", "Hazardous Hold Area" },
                    { new Guid("11111111-1111-1111-1111-111111111106"), new DateTime(2026, 9, 26, 0, 0, 0, 0, DateTimeKind.Utc), "Export-grade items reserved for export channels.", "Export Storage" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "warehouse_locations",
                keyColumn: "id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111105"));

            migrationBuilder.DeleteData(
                table: "warehouse_locations",
                keyColumn: "id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111106"));
        }
    }
}
