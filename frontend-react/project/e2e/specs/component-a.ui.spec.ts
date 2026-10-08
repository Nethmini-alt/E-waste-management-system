import { expect, test } from '@playwright/test';
import { E2E } from '../env';
import { createHousehold } from '../support/accounts';
import { stubs } from '../support/stubs';

test('TC-A-UI-001: validates and submits a three-item household submission through the web app', async ({
  browser,
}) => {
  await stubs.reset();
  await stubs.configure({ validator: 'approval' });
  const household = await createHousehold();
  const context = await browser.newContext({ baseURL: E2E.webUrl });

  try {
    const page = await context.newPage();
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(household.email);
    await page.locator('input[type="password"]').fill(household.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login$/);

    await page.goto('/submissions/new');
    const submissionRequests: unknown[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().endsWith('/api/v1/submissions')) {
        submissionRequests.push(request.postDataJSON());
      }
    });

    const submitButton = page.getByRole('button', { name: 'Submit e-waste item' });
    await submitButton.click();
    await expect(page.locator('input:invalid')).not.toHaveCount(0);
    expect(submissionRequests).toHaveLength(0);

    await page.getByPlaceholder('e.g. 12 Main Street, Colombo 03').fill('10 Galle Road, Colombo 03');
    await page.getByPlaceholder('e.g. 0771234567 or +94771234567').fill('0771234567');
    await page.locator('#submit-category').selectOption('IT Equipment');
    await page.locator('#submit-weight').fill('12');

    for (const [index, name] of ['Old laptop', 'UPS battery', 'Desktop computer'].entries()) {
      if (index > 0) {
        await page.getByRole('button', { name: 'Add another item' }).click();
      }
      await page.getByPlaceholder('Item name (e.g. Laptop)').nth(index).fill(name);
      await page
        .getByPlaceholder('Description (e.g. Old laptop, screen cracked, still boots)')
        .nth(index)
        .fill(`${name} ready for safe recycling`);
    }

    await expect(page.getByText('Items (3/3)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add another item' })).toBeDisabled();

    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith('/api/v1/submissions') &&
        response.status() === 201,
    );
    await submitButton.click();
    const submissionResponse = await responsePromise;
    const submitted = await submissionResponse.json();

    expect(submitted.userId).toBe(household.userId);
    expect(submitted.category).toBe('IT Equipment');
    expect(submitted.items.map((item: { itemName: string }) => item.itemName)).toEqual([
      'Old laptop',
      'UPS battery',
      'Desktop computer',
    ]);
    expect(submitted.workflow.workflowId).toBeTruthy();

    await expect(page.getByText('Submission recorded')).toBeVisible();
    await expect(page.getByText('Awaiting review')).toBeVisible({ timeout: 30_000 });

    const analyzerCalls = await stubs.callsFor(submitted.workflow.workflowId);
    expect(analyzerCalls.map((call) => call.service)).toContain('analyzer');

    await page.goto('/submissions/mine');
    await expect(page.getByRole('heading', { name: 'My submissions' })).toBeVisible();
    await expect(page.getByText('Awaiting review')).toBeVisible();
    await expect(page.getByText('10 Galle Road, Colombo 03')).toBeVisible();
  } finally {
    await context.close();
    await household.dispose();
  }
});

test('TC-A-UI-002: prevents household accounts from accessing the corporate CSV upload', async ({
  browser,
}) => {
  await stubs.reset();
  const household = await createHousehold();
  const context = await browser.newContext({ baseURL: E2E.webUrl });

  try {
    const page = await context.newPage();
    await page.goto('/login');
    await page.locator('input[type="email"]').fill(household.email);
    await page.locator('input[type="password"]').fill(household.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login$/);

    await page.goto('/submissions/new');
    await expect(page.getByRole('tab', { name: 'Upload CSV' })).toHaveCount(0);
  } finally {
    await context.close();
    await household.dispose();
  }
});
