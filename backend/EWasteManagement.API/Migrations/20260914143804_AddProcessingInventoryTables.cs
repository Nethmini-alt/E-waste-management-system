using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace EWasteManagement.API.Migrations
{
    /// <inheritdoc />
    public partial class AddProcessingInventoryTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "collector_payments",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collector_id = table.Column<Guid>(type: "uuid", nullable: false),
                    amount = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    paid_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collector_payments", x => x.id);
                    table.CheckConstraint("ck_collector_payments_source_type", "source_type IN ('job','extrawaste')");
                    table.CheckConstraint("ck_collector_payments_status", "status IN ('pending','paid')");
                });

            migrationBuilder.CreateTable(
                name: "extra_waste_receipts",
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
                    table.PrimaryKey("PK_extra_waste_receipts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "rate_policies",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    rate_per_kg = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    effective_from = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rate_policies", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "warehouse_locations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_warehouse_locations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "inventory_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    origin_type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    job_id = table.Column<Guid>(type: "uuid", nullable: true),
                    submission_id = table.Column<Guid>(type: "uuid", nullable: true),
                    extra_waste_receipt_id = table.Column<Guid>(type: "uuid", nullable: true),
                    parent_inventory_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    item_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    verified_weight_kg = table.Column<decimal>(type: "numeric(10,3)", nullable: false),
                    current_location_id = table.Column<Guid>(type: "uuid", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_inventory_items", x => x.id);
                    table.CheckConstraint("ck_inventory_items_origin_type", "origin_type IN ('jobcollection','extrawaste')");
                    table.CheckConstraint("ck_inventory_items_status", "status IN ('received','sorting','dismantling','classified','readyforsale','exportonly','onhold')");
                    table.ForeignKey(
                        name: "FK_inventory_items_extra_waste_receipts_extra_waste_receipt_id",
                        column: x => x.extra_waste_receipt_id,
                        principalTable: "extra_waste_receipts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_items_inventory_items_parent_inventory_item_id",
                        column: x => x.parent_inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_inventory_items_warehouse_locations_current_location_id",
                        column: x => x.current_location_id,
                        principalTable: "warehouse_locations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "classification_records",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    inventory_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    sub_category = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    source = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    confidence_score = table.Column<decimal>(type: "numeric(4,3)", nullable: true),
                    classified_by_staff_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_final = table.Column<bool>(type: "boolean", nullable: false),
                    overridden_by_staff_id = table.Column<Guid>(type: "uuid", nullable: true),
                    override_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    classified_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_classification_records", x => x.id);
                    table.CheckConstraint("ck_classification_records_category", "category IN ('reusable','localrecyclable','hazardous','exportonly')");
                    table.CheckConstraint("ck_classification_records_source", "source IN ('manual','ai')");
                    table.ForeignKey(
                        name: "FK_classification_records_inventory_items_inventory_item_id",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "extra_waste_receipt_items",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    extra_waste_receipt_id = table.Column<Guid>(type: "uuid", nullable: false),
                    item_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    accepted = table.Column<bool>(type: "boolean", nullable: false),
                    rejection_reason = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    inventory_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_extra_waste_receipt_items", x => x.id);
                    table.ForeignKey(
                        name: "FK_extra_waste_receipt_items_extra_waste_receipts_extra_waste_~",
                        column: x => x.extra_waste_receipt_id,
                        principalTable: "extra_waste_receipts",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_extra_waste_receipt_items_inventory_items_inventory_item_id",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "processing_logs",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    inventory_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                    action = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    performed_by_staff_id = table.Column<Guid>(type: "uuid", nullable: false),
                    performed_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    notes = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false),
                    created_at = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_processing_logs", x => x.id);
                    table.ForeignKey(
                        name: "FK_processing_logs_inventory_items_inventory_item_id",
                        column: x => x.inventory_item_id,
                        principalTable: "inventory_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_classification_records_inventory_item_id",
                table: "classification_records",
                column: "inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_collector_payments_source_type_source_id",
                table: "collector_payments",
                columns: new[] { "source_type", "source_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_extra_waste_receipt_items_extra_waste_receipt_id",
                table: "extra_waste_receipt_items",
                column: "extra_waste_receipt_id");

            migrationBuilder.CreateIndex(
                name: "IX_extra_waste_receipt_items_inventory_item_id",
                table: "extra_waste_receipt_items",
                column: "inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_current_location_id",
                table: "inventory_items",
                column: "current_location_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_extra_waste_receipt_id",
                table: "inventory_items",
                column: "extra_waste_receipt_id");

            migrationBuilder.CreateIndex(
                name: "IX_inventory_items_parent_inventory_item_id",
                table: "inventory_items",
                column: "parent_inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_processing_logs_inventory_item_id",
                table: "processing_logs",
                column: "inventory_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_rate_policies_item_type",
                table: "rate_policies",
                column: "item_type",
                unique: true,
                filter: "is_active = true");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "classification_records");

            migrationBuilder.DropTable(
                name: "collector_payments");

            migrationBuilder.DropTable(
                name: "extra_waste_receipt_items");

            migrationBuilder.DropTable(
                name: "processing_logs");

            migrationBuilder.DropTable(
                name: "rate_policies");

            migrationBuilder.DropTable(
                name: "inventory_items");

            migrationBuilder.DropTable(
                name: "extra_waste_receipts");

            migrationBuilder.DropTable(
                name: "warehouse_locations");
        }
    }
}
