using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class SeedProcessingReferenceData : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.InsertData(
                table: "rate_policies",
                columns: new[] { "id", "created_at", "effective_from", "is_active", "item_type", "rate_per_kg" },
                values: new object[,]
                {
                    { new Guid("22222222-2222-2222-2222-222222222201"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), true, "Laptop", 50m },
                    { new Guid("22222222-2222-2222-2222-222222222202"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), true, "Mobile Phone", 80m },
                    { new Guid("22222222-2222-2222-2222-222222222203"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), true, "Battery", 30m },
                    { new Guid("22222222-2222-2222-2222-222222222204"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), true, "General Household Electronics", 40m }
                });

            migrationBuilder.InsertData(
                table: "warehouse_locations",
                columns: new[] { "id", "created_at", "description", "name" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111101"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), "Where collector deliveries and extra-waste drop-offs are first received and weighed.", "Receiving Bay" },
                    { new Guid("11111111-1111-1111-1111-111111111102"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), "Items are sorted by category before dismantling or direct classification.", "Sorting Area" },
                    { new Guid("11111111-1111-1111-1111-111111111103"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), "Items are broken down into separately trackable child components.", "Dismantling Area" },
                    { new Guid("11111111-1111-1111-1111-111111111104"), new DateTime(2026, 9, 16, 0, 0, 0, 0, DateTimeKind.Utc), "Classified items awaiting handoff to Component D.", "Ready-for-Sale Storage" }
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "rate_policies",
                keyColumn: "id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222201"));

            migrationBuilder.DeleteData(
                table: "rate_policies",
                keyColumn: "id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222202"));

            migrationBuilder.DeleteData(
                table: "rate_policies",
                keyColumn: "id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222203"));

            migrationBuilder.DeleteData(
                table: "rate_policies",
                keyColumn: "id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222204"));

            migrationBuilder.DeleteData(
                table: "warehouse_locations",
                keyColumn: "id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111101"));

            migrationBuilder.DeleteData(
                table: "warehouse_locations",
                keyColumn: "id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111102"));

            migrationBuilder.DeleteData(
                table: "warehouse_locations",
                keyColumn: "id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111103"));

            migrationBuilder.DeleteData(
                table: "warehouse_locations",
                keyColumn: "id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111104"));
        }
    }
}
