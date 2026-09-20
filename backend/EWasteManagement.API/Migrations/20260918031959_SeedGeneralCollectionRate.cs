using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class SeedGeneralCollectionRate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "rate_policies",
                columns: new[] { "id", "created_at", "effective_from", "is_active", "item_type", "rate_per_kg" },
                values: new object[] { new Guid("22222222-2222-2222-2222-222222222205"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), true, "GeneralCollection", 20m });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "rate_policies",
                keyColumn: "id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222205"));
        }
    }
}