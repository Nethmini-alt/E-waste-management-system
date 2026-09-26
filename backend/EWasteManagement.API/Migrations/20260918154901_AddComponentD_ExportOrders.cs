using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddComponentD_ExportOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "export_orders",
                columns: table => new
                {
                    export_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    destination_country = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    shipment_date = table.Column<DateOnly>(type: "date", nullable: false),
                    total_weight_kg = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    total_value = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_export_orders", x => x.export_order_id);
                    table.CheckConstraint("CK_export_orders_status", "status IN ('draft','pendingapproval','approved','shipped','completed','cancelled')");
                    table.CheckConstraint("CK_export_orders_value_non_negative", "total_value >= 0");
                    table.CheckConstraint("CK_export_orders_weight_non_negative", "total_weight_kg >= 0");
                    table.ForeignKey(
                        name: "FK_export_orders_buyers_buyer_id",
                        column: x => x.buyer_id,
                        principalTable: "buyers",
                        principalColumn: "buyer_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_export_orders_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "export_order_items",
                columns: table => new
                {
                    export_order_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    export_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recovered_material_id = table.Column<Guid>(type: "uuid", nullable: false),
                    material_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    quantity_kg = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_export_order_items", x => x.export_order_item_id);
                    table.CheckConstraint("CK_export_order_items_price", "unit_price >= 0");
                    table.CheckConstraint("CK_export_order_items_qty", "quantity_kg > 0");
                    table.CheckConstraint("CK_export_order_items_total", "line_total >= 0");
                    table.ForeignKey(
                        name: "FK_export_order_items_export_orders_export_order_id",
                        column: x => x.export_order_id,
                        principalTable: "export_orders",
                        principalColumn: "export_order_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_export_order_items_export_order_id",
                table: "export_order_items",
                column: "export_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_export_order_items_recovered_material_id",
                table: "export_order_items",
                column: "recovered_material_id");

            migrationBuilder.CreateIndex(
                name: "IX_export_orders_buyer_id",
                table: "export_orders",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "IX_export_orders_created_by_user_id",
                table: "export_orders",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_export_orders_destination_country",
                table: "export_orders",
                column: "destination_country");

            migrationBuilder.CreateIndex(
                name: "IX_export_orders_status_order_date",
                table: "export_orders",
                columns: new[] { "status", "order_date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "export_order_items");

            migrationBuilder.DropTable(
                name: "export_orders");
        }
    }
}
