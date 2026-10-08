// TC-E2E-007 — the same business workflow driven through the React web app at
// both ends: a household submits through the real form, and management staff
// see the outcome on the inventory and sales pages. The middle (collector app
// and warehouse worker app) is driven through the API, because those users
// work in the Flutter app, not the web app.
//
// Evidence: video, screenshots and a Playwright trace are recorded for this test.

import { expect, test, type Browser, type Page } from '@playwright/test';
import { E2E } from '../env';
import { createCast, type Cast } from '../support/workflow';
import { waitForWorkflowStatus } from '../steps/a-submission';
import { approveWorkflow, collectJob, waitForAssignedJob } from '../steps/b-collection';
import { dismantleToMaterial, receiveDelivery } from '../steps/c-inventory';
import { sellMaterial } from '../steps/d-sales';

let cast: Cast;
test.beforeEach(async () => { cast = await createCast(); });
test.afterEach(async () => { await cast.disposeAll(); });

async function signIn(browser: Browser, email: string, password: string): Promise<Page> {
  const context = await browser.newContext({ baseURL: E2E.webUrl, recordVideo: { dir: test.info().outputPath('videos') } });
  const page = await context.newPage();
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  return page;
}

test('TC-E2E-007: household submits in the web app → … → staff see the sold Copper in the web app', async ({ browser }) => {
  // ---- A (UI): household fills in the real submission form ----
  const customer = await signIn(browser, cast.household.email, cast.household.password);
  const submissionId = await test.step('A (UI) — household submits e-waste through the form', async () => {
    await customer.goto('/submissions/new');
    await customer.locator('select').first().selectOption('IT Equipment');
    await customer.locator('input[type="number"]').first().fill('12');
    await customer.getByPlaceholder('e.g. 12 Main Street, Colombo 03').fill('No 10, Galle Road, Colombo 03');
    await customer.getByPlaceholder('e.g. 0771234567 or +94771234567').fill('0771234567');
    await customer.getByPlaceholder('Item name (e.g. Laptop)').first().fill('Old laptop');
    await customer.getByPlaceholder(/^Description/).first().fill('Dell laptop, cracked screen, still boots');
    await customer.getByRole('button', { name: 'Submit e-waste item' }).click();

    await expect(customer.getByText('Submission recorded')).toBeVisible();
    // The page polls the API; the stub Validator asks for human approval.
    await expect(customer.getByText('Awaiting review')).toBeVisible({ timeout: 30_000 });
    await customer.screenshot({ path: test.info().outputPath('A-submission-awaiting-review.png'), fullPage: true });
    return (await customer.locator('code').first().innerText()).trim();
  });

  // ---- B, C, D (API): the Flutter-app users and the sale ----
  const material = await test.step('B, C, D (API) — approve, collect, receive, dismantle, sell', async () => {
    const mine: any[] = await cast.household.call('GET', '/api/v1/submissions/mine');
    const workflowId = mine.find((s) => s.id === submissionId).workflow.workflowId;
    await waitForWorkflowStatus(cast.staff, workflowId, 'PendingApproval');
    await approveWorkflow(cast.staff, workflowId);
    const jobId = await waitForAssignedJob(cast.staff, workflowId, cast.collectorId);
    await collectJob(cast.collector, jobId);
    const unit = await receiveDelivery(cast.worker, jobId, cast.collectorId, 11.5, 'Laptop');
    const material = await dismantleToMaterial(cast.worker, unit.inventoryItemId, E2E.material, 2.5);
    const sale = await sellMaterial(cast.staff, material.materialItemId, E2E.material, 2);
    return { ...material, ...sale };
  });

  // ---- A (UI): the customer's list now shows the pickup as collected ----
  await test.step('A (UI) — household sees the submission as Collected', async () => {
    await customer.goto('/submissions/mine');
    await expect(customer.getByText('Collected').first()).toBeVisible();
    await customer.screenshot({ path: test.info().outputPath('A-my-submissions-collected.png'), fullPage: true });
  });

  // ---- C + D (UI): staff check the result in the web app ----
  const staffPage = await signIn(browser, cast.staff.email, cast.staff.password);
  await test.step('C (UI) — staff see the recovered Copper as Ready for sale', async () => {
    await staffPage.goto(`/processing/inventory/${material.materialItemId}`);
    await expect(staffPage.getByText(E2E.material).first()).toBeVisible();
    await expect(staffPage.getByText(/ready for sale/i).first()).toBeVisible();
    await staffPage.screenshot({ path: test.info().outputPath('C-material-ready-for-sale.png'), fullPage: true });
  });

  await test.step('D (UI) — staff see the completed sales order', async () => {
    await staffPage.goto('/sales-orders');
    // This run's order, found by its id prefix in the table (not the buyer filter dropdown).
    const row = staffPage.getByRole('row').filter({ hasText: material.salesOrderId.slice(0, 8) });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Completed');
    await expect(row).toContainText(`${E2E.material} (2 kg)`);
    await expect(row).toContainText(`Rs. ${material.totalAmount.toFixed(2)}`);
    await staffPage.screenshot({ path: test.info().outputPath('D-sales-orders.png'), fullPage: true });
  });

  await customer.context().close();
  await staffPage.context().close();
});
