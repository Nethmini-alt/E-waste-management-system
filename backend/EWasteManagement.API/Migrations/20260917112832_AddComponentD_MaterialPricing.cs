using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddComponentD_MaterialPricing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "material_pricing",
                columns: table => new
                {
                    pricing_id = table.Column<Guid>(type: "uuid", nullable: false),
                    material_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    price_per_kg = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    effective_date = table.Column<DateOnly>(type: "date", nullable: false),
                    expiry_date = table.Column<DateOnly>(type: "date", nullable: true),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_material_pricing", x => x.pricing_id);
                    table.CheckConstraint("CK_material_pricing_dates", "expiry_date IS NULL OR expiry_date > effective_date");
                    table.CheckConstraint("CK_material_pricing_price_positive", "price_per_kg > 0");
                    table.CheckConstraint("CK_material_pricing_status", "status IN ('draft','approved','expired')");
                    table.ForeignKey(
                        name: "FK_material_pricing_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_material_pricing_created_by_user_id",
                table: "material_pricing",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_material_pricing_material_type_effective_date",
                table: "material_pricing",
                columns: new[] { "material_type", "effective_date" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_material_pricing_material_type_status",
                table: "material_pricing",
                columns: new[] { "material_type", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "material_pricing");
        }
    }
}
