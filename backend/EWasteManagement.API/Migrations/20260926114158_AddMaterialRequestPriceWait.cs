using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialRequestPriceWait : Migration
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

            migrationBuilder.AddColumn<string>(
                name: "last_matching_note",
                table: "material_requests",
                type: "character varying(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_sales_orders_status",
                table: "sales_orders",
                sql: "status IN ('waitingforstock','waitingforprice','pendingplanapproval','draft','confirmed','completed','cancelled')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_material_requests_status",
                table: "material_requests",
                sql: "status IN ('waiting','waitingforprice','generatingplan','plangenerated','plangenerationfailed','orderplaced','fulfilled','cancelled')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_sales_orders_status",
                table: "sales_orders");

            migrationBuilder.DropCheckConstraint(
                name: "ck_material_requests_status",
                table: "material_requests");

            migrationBuilder.DropColumn(
                name: "last_matching_note",
                table: "material_requests");

            migrationBuilder.AddCheckConstraint(
                name: "CK_sales_orders_status",
                table: "sales_orders",
                sql: "status IN ('waitingforstock','pendingplanapproval','draft','confirmed','completed','cancelled')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_material_requests_status",
                table: "material_requests",
                sql: "status IN ('waiting','generatingplan','plangenerated','plangenerationfailed','orderplaced','fulfilled','cancelled')");
        }
    }
}
