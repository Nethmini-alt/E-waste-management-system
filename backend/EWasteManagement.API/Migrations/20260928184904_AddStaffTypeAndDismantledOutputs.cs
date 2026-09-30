using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddStaffTypeAndDismantledOutputs : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_inventory_items_status",
                table: "inventory_items");

            migrationBuilder.AddColumn<string>(
                name: "staff_type",
                table: "users",
                type: "character varying(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "kind",
                table: "inventory_items",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "unit");

            // Every existing staff account is management staff (web users of every component).
            migrationBuilder.Sql("UPDATE users SET staff_type = 'management' WHERE role = 'staff';");

            // Items created by earlier dismantling are components.
            migrationBuilder.Sql("UPDATE inventory_items SET kind = 'component' WHERE parent_inventory_item_id IS NOT NULL;");

            migrationBuilder.AddCheckConstraint(
                name: "CK_users_staff_type",
                table: "users",
                sql: "(role = 'staff' AND staff_type IN ('management','worker')) OR (role <> 'staff' AND staff_type IS NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "ck_inventory_items_kind",
                table: "inventory_items",
                sql: "kind IN ('unit','component','material')");

            migrationBuilder.AddCheckConstraint(
                name: "ck_inventory_items_status",
                table: "inventory_items",
                sql: "status IN ('received','sorting','dismantling','classified','readyforsale','exportonly','onhold','recovered')");

            // Components that were never touched after dismantling get the new entry status.
            migrationBuilder.Sql(
                "UPDATE inventory_items SET status = 'recovered' WHERE kind = 'component' AND status = 'received';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE inventory_items SET status = 'received' WHERE status = 'recovered';");

            migrationBuilder.DropCheckConstraint(
                name: "CK_users_staff_type",
                table: "users");

            migrationBuilder.DropCheckConstraint(
                name: "ck_inventory_items_kind",
                table: "inventory_items");

            migrationBuilder.DropCheckConstraint(
                name: "ck_inventory_items_status",
                table: "inventory_items");

            migrationBuilder.DropColumn(
                name: "staff_type",
                table: "users");

            migrationBuilder.DropColumn(
                name: "kind",
                table: "inventory_items");

            migrationBuilder.AddCheckConstraint(
                name: "ck_inventory_items_status",
                table: "inventory_items",
                sql: "status IN ('received','sorting','dismantling','classified','readyforsale','exportonly','onhold')");
        }
    }
}
