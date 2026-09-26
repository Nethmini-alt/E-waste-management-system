using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentSnapshotAndAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "calculation_snapshot",
                table: "collector_payments",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_staff_id",
                table: "collector_payments",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "paid_by_staff_id",
                table: "collector_payments",
                type: "uuid",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "calculation_snapshot",
                table: "collector_payments");

            migrationBuilder.DropColumn(
                name: "created_by_staff_id",
                table: "collector_payments");

            migrationBuilder.DropColumn(
                name: "paid_by_staff_id",
                table: "collector_payments");
        }
    }
}
