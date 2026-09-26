using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddAssessmentAnswersToSubmission : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "xmin",
                table: "warehouse_locations");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "rate_policies");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "processing_logs");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "extra_waste_receipts");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "extra_waste_receipt_items");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "collector_payments");

            migrationBuilder.DropColumn(
                name: "xmin",
                table: "classification_records");

            migrationBuilder.AddColumn<string>(
                name: "AssessmentAnswersJson",
                table: "Submissions",
                type: "text",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AssessmentAnswersJson",
                table: "Submissions");

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "warehouse_locations",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "rate_policies",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "processing_logs",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "inventory_items",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "extra_waste_receipts",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "extra_waste_receipt_items",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "collector_payments",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);

            migrationBuilder.AddColumn<uint>(
                name: "xmin",
                table: "classification_records",
                type: "xid",
                rowVersion: true,
                nullable: false,
                defaultValue: 0u);
        }
    }
}
