using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddComponentD_SalesOrders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "sales_orders",
                columns: table => new
                {
                    sales_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    buyer_id = table.Column<Guid>(type: "uuid", nullable: false),
                    order_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    total_amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    notes = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    updated_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_orders", x => x.sales_order_id);
                    table.CheckConstraint("CK_sales_orders_status", "status IN ('draft','confirmed','completed','cancelled')");
                    table.CheckConstraint("CK_sales_orders_total_non_negative", "total_amount >= 0");
                    table.ForeignKey(
                        name: "FK_sales_orders_buyers_buyer_id",
                        column: x => x.buyer_id,
                        principalTable: "buyers",
                        principalColumn: "buyer_id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_sales_orders_users_created_by_user_id",
                        column: x => x.created_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "sales_order_items",
                columns: table => new
                {
                    sales_order_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sales_order_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recovered_material_id = table.Column<Guid>(type: "uuid", nullable: false),
                    material_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    quantity_kg = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    unit_price = table.Column<decimal>(type: "numeric(12,2)", precision: 12, scale: 2, nullable: false),
                    line_total = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sales_order_items", x => x.sales_order_item_id);
                    table.CheckConstraint("CK_sales_order_items_price_non_negative", "unit_price >= 0");
                    table.CheckConstraint("CK_sales_order_items_quantity_positive", "quantity_kg > 0");
                    table.CheckConstraint("CK_sales_order_items_total_non_negative", "line_total >= 0");
                    table.ForeignKey(
                        name: "FK_sales_order_items_sales_orders_sales_order_id",
                        column: x => x.sales_order_id,
                        principalTable: "sales_orders",
                        principalColumn: "sales_order_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sales_order_items_recovered_material_id",
                table: "sales_order_items",
                column: "recovered_material_id");

            migrationBuilder.CreateIndex(
                name: "IX_sales_order_items_sales_order_id",
                table: "sales_order_items",
                column: "sales_order_id");

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_buyer_id",
                table: "sales_orders",
                column: "buyer_id");

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_created_by_user_id",
                table: "sales_orders",
                column: "created_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_status_order_date",
                table: "sales_orders",
                columns: new[] { "status", "order_date" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sales_order_items");

            migrationBuilder.DropTable(
                name: "sales_orders");
        }
    }
}
