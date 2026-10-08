// G0 — runs once before every E2E spec (Playwright "setup" project).
// Verifies the test environment and creates the reference data the workflow
// needs. If this fails, nothing else runs, so environment problems are
// reported as environment problems, not as confusing workflow failures.

import { expect, test as setup } from '@playwright/test';
import { E2E } from '../env';
import { anonymous } from '../support/api';
import { ensureAdmin } from '../support/accounts';
import { stubs } from '../support/stubs';
import { ensureApprovedPrice } from '../steps/d-sales';

setup('G0: API, database, stubs and reference data are ready', async () => {
  await setup.step('API is up and migrations ran', async () => {
    const anon = await anonymous();
    expect((await anon.get('/healthz')).status()).toBe(200);
    await anon.dispose();
  });

  await setup.step('stub agents and stub maps are up', async () => {
    await stubs.reset();
  });

  const admin = await setup.step('bootstrap admin account', async () => {
    const admin = await ensureAdmin();
    expect(admin.role).toBe('Admin');
    return admin;
  });

  await setup.step('reference data seeded by migrations', async () => {
    const locations: any[] = await admin.call('GET', '/api/v1/inventory/lookups/warehouse-locations');
    expect(locations.length).toBeGreaterThan(0);
    const rates: any[] = await admin.call('GET', '/api/v1/inventory/lookups/rate-policies');
    expect(rates.map((r) => r.itemType)).toEqual(expect.arrayContaining(['Laptop', 'GeneralCollection']));
  });

  await setup.step(`approved live price for ${E2E.material}`, async () => {
    const price = await ensureApprovedPrice(admin, E2E.material, E2E.materialPricePerKg);
    expect(price).toBeGreaterThan(0);
    // Dismantling only accepts material names Sales has priced.
    const materialTypes: string[] = await admin.call('GET', '/api/v1/inventory/lookups/material-types');
    expect(materialTypes).toContain(E2E.material);
  });

  await admin.dispose();
});
