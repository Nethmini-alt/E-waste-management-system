using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddCollectorDeliveries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "delivery_id",
                table: "collector_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "collector_deliveries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    collector_id = table.Column<Guid>(type: "uuid", nullable: false),
                    received_by_staff_id = table.Column<Guid>(type: "uuid", nullable: false),
                    received_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collector_deliveries", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_collector_payments_delivery_id",
                table: "collector_payments",
                column: "delivery_id");

            migrationBuilder.AddForeignKey(
                name: "FK_collector_payments_collector_deliveries_delivery_id",
                table: "collector_payments",
                column: "delivery_id",
                principalTable: "collector_deliveries",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_collector_payments_collector_deliveries_delivery_id",
                table: "collector_payments");

            migrationBuilder.DropTable(
                name: "collector_deliveries");

            migrationBuilder.DropIndex(
                name: "IX_collector_payments_delivery_id",
                table: "collector_payments");

            migrationBuilder.DropColumn(
                name: "delivery_id",
                table: "collector_payments");
        }
    }
}
