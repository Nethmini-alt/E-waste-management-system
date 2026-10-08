// G4 — Accessibility testing of the React web app (axe-core + Playwright)
//
// Each main page of every component is loaded in a real browser, signed in as
// the role that uses it, and scanned by axe-core against WCAG 2.1 level A and
// AA rules. A page passes when it has no "serious" or "critical" violations
// (the levels that block users of screen readers or keyboards). Minor and
// moderate findings are still recorded in the attached report.
//
// TC-A11Y-001..014  automated WCAG scan per page
// TC-A11Y-015       sign-in works with the keyboard only

import fs from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Browser, type Page } from '@playwright/test';
import { E2E } from '../env';
import { createHousehold, createStaff, ensureAdmin } from '../support/accounts';
import type { Actor } from '../support/api';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const BLOCKING = ['serious', 'critical'];

interface PageUnderTest {
  id: string;
  component: string;
  name: string;
  path: string;
  as: 'public' | 'household' | 'staff' | 'admin';
}

const PAGES: PageUnderTest[] = [
  { id: 'TC-A11Y-001', component: 'Public', name: 'Landing page', path: '/welcome', as: 'public' },
  { id: 'TC-A11Y-002', component: 'Public', name: 'Sign in', path: '/login', as: 'public' },
  { id: 'TC-A11Y-003', component: 'Public', name: 'Register', path: '/register', as: 'public' },
  { id: 'TC-A11Y-004', component: 'A', name: 'Submit e-waste form', path: '/submissions/new', as: 'household' },
  { id: 'TC-A11Y-005', component: 'A', name: 'My submissions', path: '/submissions/mine', as: 'household' },
  { id: 'TC-A11Y-006', component: 'A', name: 'Submission review', path: '/submissions/review', as: 'staff' },
  { id: 'TC-A11Y-007', component: 'B', name: 'Collection jobs dashboard', path: '/collection/jobs', as: 'staff' },
  { id: 'TC-A11Y-008', component: 'B', name: 'Collectors', path: '/collection/collectors', as: 'staff' },
  { id: 'TC-A11Y-009', component: 'C', name: 'Receive waste', path: '/processing/receive', as: 'staff' },
  { id: 'TC-A11Y-010', component: 'C', name: 'Inventory list', path: '/processing/inventory', as: 'staff' },
  { id: 'TC-A11Y-011', component: 'D', name: 'Pricing', path: '/pricing', as: 'staff' },
  { id: 'TC-A11Y-012', component: 'D', name: 'Sales orders', path: '/sales-orders', as: 'staff' },
  { id: 'TC-A11Y-013', component: 'D', name: 'Revenue dashboard', path: '/revenue', as: 'staff' },
  { id: 'TC-A11Y-014', component: 'Admin', name: 'Staff management', path: '/admin/staff', as: 'admin' },
];

const accounts: Partial<Record<PageUnderTest['as'], Actor>> = {};

test.beforeAll(async () => {
  accounts.admin = await ensureAdmin();
  accounts.staff = await createStaff(accounts.admin, 'Management');
  accounts.household = await createHousehold();
});
test.afterAll(async () => {
  for (const a of Object.values(accounts)) await a?.dispose();
});

async function openAs(browser: Browser, as: PageUnderTest['as']): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: E2E.webUrl })).newPage();
  if (as === 'public') return page;
  const user = accounts[as]!;
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill(user.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login$/);
  return page;
}

for (const p of PAGES) {
  test(`${p.id}: [${p.component}] ${p.name} (${p.path}) has no serious or critical WCAG 2.1 AA violations`, async ({ browser }) => {
    const page = await openAs(browser, p.as);
    await page.goto(p.path);
    await expect(page).toHaveURL(new RegExp(`${p.path.replace(/\//g, '\\/')}$`)); // not redirected away
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();

    // Evidence: the full axe result and a readable summary, attached to the HTML report.
    const summary = results.violations.map((v) => ({
      rule: v.id, impact: v.impact, help: v.help, elements: v.nodes.length,
      examples: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
    }));
    const fullPath = test.info().outputPath('axe-full.json');
    fs.writeFileSync(fullPath, JSON.stringify(results, null, 2));
    await test.info().attach('axe-summary.json', { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });
    await test.info().attach('axe-full.json', { path: fullPath, contentType: 'application/json' });
    await test.info().attach('page.png', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    test.info().annotations.push({
      type: 'axe',
      description: `${results.passes.length} rules passed, ${results.violations.length} violated ` +
        `(${summary.map((s) => `${s.rule}:${s.impact}`).join(', ') || 'none'})`,
    });

    const blocking = summary.filter((s) => BLOCKING.includes(s.impact ?? ''));
    expect(blocking, `serious/critical accessibility violations on ${p.path}`).toEqual([]);
    await page.context().close();
  });
}

test('TC-A11Y-015: [Public] sign-in can be completed with the keyboard only', async ({ browser }) => {
  const page = await openAs(browser, 'public');
  const user = accounts.staff!;
  await page.goto('/login');

  // Tab from the top of the page until the email field has focus (no mouse).
  let reached = false;
  for (let i = 0; i < 25 && !reached; i++) {
    await page.keyboard.press('Tab');
    reached = await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type === 'email');
  }
  expect(reached, 'email field reachable with Tab').toBe(true);
  await page.keyboard.type(user.email);

  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.type), 'Tab moves to password').toBe('password');
  await page.keyboard.type(user.password);

  await page.keyboard.press('Enter'); // submit from the keyboard
  await expect(page).not.toHaveURL(/\/login$/);
  await page.context().close();
});
