using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddComponentD_RevenueTransactions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "revenue_transactions",
                columns: table => new
                {
                    revenue_id = table.Column<Guid>(type: "uuid", nullable: false),
                    transaction_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    reference_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(14,2)", precision: 14, scale: 2, nullable: false),
                    transaction_date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    remarks = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    recorded_by_user_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_revenue_transactions", x => x.revenue_id);
                    table.CheckConstraint("CK_revenue_transactions_amount_positive", "amount > 0");
                    table.CheckConstraint("CK_revenue_transactions_type", "transaction_type IN ('localsale','export')");
                    table.ForeignKey(
                        name: "FK_revenue_transactions_users_recorded_by_user_id",
                        column: x => x.recorded_by_user_id,
                        principalTable: "users",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_revenue_transactions_recorded_by_user_id",
                table: "revenue_transactions",
                column: "recorded_by_user_id");

            migrationBuilder.CreateIndex(
                name: "IX_revenue_transactions_transaction_date",
                table: "revenue_transactions",
                column: "transaction_date");

            migrationBuilder.CreateIndex(
                name: "IX_revenue_transactions_transaction_type_reference_id",
                table: "revenue_transactions",
                columns: new[] { "transaction_type", "reference_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "revenue_transactions");
        }
    }
}
