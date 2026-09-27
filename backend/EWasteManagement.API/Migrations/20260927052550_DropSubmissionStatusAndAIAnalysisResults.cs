using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class DropSubmissionStatusAndAIAnalysisResults : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AIAnalysisResults");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "Submissions");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "Submissions",
                type: "text",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "AIAnalysisResults",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    AnalyzedAt = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    EstimatedValueUsd = table.Column<decimal>(type: "numeric", nullable: false),
                    EstimatedVolumeKg = table.Column<decimal>(type: "numeric", nullable: false),
                    HazardLevel = table.Column<string>(type: "text", nullable: false),
                    RequiresHumanApproval = table.Column<bool>(type: "boolean", nullable: false),
                    SubmissionId = table.Column<Guid>(type: "uuid", nullable: false),
                    WasteCategory = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AIAnalysisResults", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AIAnalysisResults_Submissions_SubmissionId",
                        column: x => x.SubmissionId,
                        principalTable: "Submissions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AIAnalysisResults_SubmissionId",
                table: "AIAnalysisResults",
                column: "SubmissionId",
                unique: true);
        }
    }
}
