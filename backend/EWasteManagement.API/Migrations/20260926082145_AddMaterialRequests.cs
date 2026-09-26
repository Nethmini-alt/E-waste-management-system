using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "material_requests",
                columns: table => new
                {
                    material_request_id = table.Column<Guid>(type: "uuid", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    material_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    quantity_kg = table.Column<decimal>(type: "numeric(12,3)", precision: 12, scale: 3, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    commercial_plan_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_material_requests", x => x.material_request_id);
                    table.CheckConstraint("ck_material_requests_quantity_positive", "quantity_kg > 0");
                    table.CheckConstraint("ck_material_requests_status", "status IN ('waiting','generatingplan','plangenerated','fulfilled','cancelled')");
                    table.ForeignKey(
                        name: "FK_material_requests_buyers_buyer_id",
                        column: x => x.buyer_id,
                        principalTable: "buyers",
                        principalColumn: "buyer_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_material_requests_commercial_plans_commercial_plan_id",
                        column: x => x.commercial_plan_id,
                        principalTable: "commercial_plans",
                        principalColumn: "commercial_plan_id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateIndex(
                name: "IX_material_requests_buyer_id",
                table: "material_requests",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "IX_material_requests_commercial_plan_id",
                table: "material_requests",
                column: "commercial_plan_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_material_requests_status_material_type",
                table: "material_requests",
                columns: new[] { "status", "material_type" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "material_requests");
        }
    }
}
