using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class RenameAIAnalysisValueToLkr : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Only the name changes. Rows written by the old Gemini-only flow hold dollar estimates; rows written
            // by the agent service (from now on) hold rupees. There is no exchange rate to convert the old ones with.
            migrationBuilder.RenameColumn(
                name: "EstimatedValueUsd",
                table: "AIAnalysisResults",
                newName: "EstimatedValueLkr");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "EstimatedValueLkr",
                table: "AIAnalysisResults",
                newName: "EstimatedValueUsd");
        }
    }
}
