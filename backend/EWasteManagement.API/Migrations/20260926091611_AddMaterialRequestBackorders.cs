using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialRequestBackorders : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_sales_orders_status",
                table: "sales_orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_material_requests_status",
                table: "material_requests");

            migrationBuilder.AddColumn<Guid>(
                name: "material_request_id",
                table: "sales_orders",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "pending_material_type",
                table: "sales_orders",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "pending_quantity_kg",
                table: "sales_orders",
                type: "numeric(12,3)",
                precision: 12,
                scale: 3,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_sales_orders_material_request_id",
                table: "sales_orders",
                column: "material_request_id",
                unique: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_sales_orders_status",
                table: "sales_orders",
                sql: "status IN ('waitingforstock','pendingplanapproval','draft','confirmed','completed','cancelled')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_material_requests_status",
                table: "material_requests",
                sql: "status IN ('waiting','generatingplan','plangenerated','plangenerationfailed','orderplaced','fulfilled','cancelled')");

            migrationBuilder.AddForeignKey(
                name: "FK_sales_orders_material_requests_material_request_id",
                table: "sales_orders",
                column: "material_request_id",
                principalTable: "material_requests",
                principalColumn: "material_request_id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_sales_orders_material_requests_material_request_id",
                table: "sales_orders");

            migrationBuilder.DropIndex(
                name: "IX_sales_orders_material_request_id",
                table: "sales_orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_sales_orders_status",
                table: "sales_orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_material_requests_status",
                table: "material_requests");

            migrationBuilder.DropColumn(
                name: "material_request_id",
                table: "sales_orders");

            migrationBuilder.DropColumn(
                name: "pending_material_type",
                table: "sales_orders");

            migrationBuilder.DropColumn(
                name: "pending_quantity_kg",
                table: "sales_orders");

            migrationBuilder.AddCheckConstraint(
                name: "CK_sales_orders_status",
                table: "sales_orders",
                sql: "status IN ('draft','confirmed','completed','cancelled')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_material_requests_status",
                table: "material_requests",
                sql: "status IN ('waiting','generatingplan','plangenerated','fulfilled','cancelled')");
        }
    }
}
