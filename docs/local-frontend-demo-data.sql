-- Local frontend demo data for the inventory-backed Sales integration.
-- Run after `dotnet ef database update` has succeeded against your local database.
-- This does not restore the dummy provider; it inserts rows into inventory_items.

INSERT INTO inventory_items (
    id, origin_type, job_id, submission_id, extra_waste_receipt_id,
    parent_inventory_item_id, item_type, status, verified_weight_kg,
    current_location_id, created_at
)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', 'extrawaste', NULL, NULL, NULL, NULL, 'Copper', 'readyforsale', 120.500, '11111111-1111-1111-1111-111111111104', NOW() - INTERVAL '2 days'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', 'extrawaste', NULL, NULL, NULL, NULL, 'Aluminium', 'readyforsale', 340.000, '11111111-1111-1111-1111-111111111104', NOW() - INTERVAL '1 day'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3', 'extrawaste', NULL, NULL, NULL, NULL, 'Gold', 'readyforsale', 0.850, '11111111-1111-1111-1111-111111111104', NOW() - INTERVAL '6 hours'),
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4', 'extrawaste', NULL, NULL, NULL, NULL, 'PCB', 'readyforsale', 75.200, '11111111-1111-1111-1111-111111111104', NOW() - INTERVAL '3 days')
ON CONFLICT (id) DO UPDATE SET
    item_type = EXCLUDED.item_type,
    status = EXCLUDED.status,
    verified_weight_kg = EXCLUDED.verified_weight_kg,
    current_location_id = EXCLUDED.current_location_id;

-- Approved prices let the local sales-order form calculate totals.
-- The first non-deleted user is used only as the audit creator for demo pricing.
--
-- material_pricing carries a partial unique index (one APPROVED row per material type), so
-- retire any other approved row for these materials before re-asserting the demo prices —
-- otherwise re-running this script against a database where someone approved their own
-- Copper/Aluminium/Gold/PCB price would fail. NULL expiry means "until replaced", i.e. live.
UPDATE material_pricing
SET status = 'expired', updated_at = NOW()
WHERE status = 'approved'
  AND material_type IN ('Copper', 'Aluminium', 'Gold', 'PCB')
  AND pricing_id NOT IN (
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid,
      'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'::uuid
  );

INSERT INTO material_pricing (
    pricing_id, material_type, price_per_kg, effective_date,
    expiry_date, status, created_by_user_id, created_at
)
SELECT pricing_id, material_type, price_per_kg, CURRENT_DATE, NULL, 'approved', users.user_id, NOW()
FROM (
    VALUES
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb1'::uuid, 'Copper', 1800.00::numeric),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb2'::uuid, 'Aluminium', 950.00::numeric),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb3'::uuid, 'Gold', 18500.00::numeric),
        ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb4'::uuid, 'PCB', 1250.00::numeric)
) AS demo(pricing_id, material_type, price_per_kg)
CROSS JOIN LATERAL (
    SELECT user_id
    FROM users
    WHERE is_deleted = FALSE
    ORDER BY created_at
    LIMIT 1
) users
ON CONFLICT (pricing_id) DO UPDATE SET
    price_per_kg = EXCLUDED.price_per_kg,
    status = EXCLUDED.status,
    effective_date = EXCLUDED.effective_date;
