using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddExtraWasteWeightAndIdempotency : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "idempotency_key",
                table: "extra_waste_receipts",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "weight_kg",
                table: "extra_waste_receipt_items",
                type: "numeric(10,3)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.CreateIndex(
                name: "IX_extra_waste_receipts_idempotency_key",
                table: "extra_waste_receipts",
                column: "idempotency_key",
                unique: true,
                filter: "idempotency_key IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_extra_waste_receipts_idempotency_key",
                table: "extra_waste_receipts");

            migrationBuilder.DropColumn(
                name: "idempotency_key",
                table: "extra_waste_receipts");

            migrationBuilder.DropColumn(
                name: "weight_kg",
                table: "extra_waste_receipt_items");
        }
    }
}
