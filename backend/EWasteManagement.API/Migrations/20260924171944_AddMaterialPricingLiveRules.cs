using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialPricingLiveRules : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Repair existing data BEFORE the new index is created, otherwise a database that
            // already broke the "one approved price per material" rule (the service layer used
            // to be the only guard) or that carries approved-but-already-expired rows would
            // make this migration fail.

            // 1. Approved rows whose expiry date has passed are no longer usable prices.
            migrationBuilder.Sql(@"
                UPDATE material_pricing
                SET status = 'expired',
                    updated_at = NOW()
                WHERE status = 'approved'
                  AND expiry_date IS NOT NULL
                  AND expiry_date <= CURRENT_DATE;");

            // 2. Collapse any duplicate approvals: keep the newest effective date per material
            //    and expire the rest. (effective_date is unique per material, so this always
            //    leaves at most one approved row behind.)
            migrationBuilder.Sql(@"
                UPDATE material_pricing
                SET status = 'expired',
                    updated_at = NOW()
                WHERE status = 'approved'
                  AND EXISTS (
                      SELECT 1
                      FROM material_pricing newer
                      WHERE newer.status = 'approved'
                        AND newer.material_type = material_pricing.material_type
                        AND newer.effective_date > material_pricing.effective_date
                  );");

            migrationBuilder.CreateIndex(
                name: "IX_material_pricing_material_type_approved_unique",
                table: "material_pricing",
                column: "material_type",
                unique: true,
                filter: "status = 'approved'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_material_pricing_material_type_approved_unique",
                table: "material_pricing");
        }
    }
}
