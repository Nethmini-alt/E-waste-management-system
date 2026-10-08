import { defineConfig } from '@playwright/test';

// G4 — reliability / recovery tests (`npm run reliability`).
//
// These tests crash and restart the API themselves, so Playwright must not
// manage it. They use their own port and database, so they never disturb the
// E2E API on 5180 (or a k6 run against it). Set before the workers start, so
// e2e/env.ts picks them up.
process.env.E2E_API_URL ??= 'http://localhost:5181';
process.env.E2E_DB_NAME ??= 'SmartEWasteDB_E2E_Reliability';

export default defineConfig({
  testDir: './e2e/reliability',
  testMatch: /.*\.reliability\.spec\.ts/,
  // One API process shared by every test, crashed on purpose: strictly one at a time.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reliability-report', open: 'never' }],
    ['junit', { outputFile: 'reliability-results/junit.xml' }],
  ],
  outputDir: 'reliability-results/artifacts',
  use: { trace: 'on' },

  webServer: [
    {
      command: 'node e2e/stubs/agent-stubs.mjs',
      url: 'http://localhost:18090/__health',
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
  ],
});
