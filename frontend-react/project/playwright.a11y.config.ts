import { defineConfig, devices } from '@playwright/test';
import base from './playwright.config';
import { E2E } from './e2e/env';

// G4 — accessibility tests (`npm run a11y`). Same G0 environment as the E2E
// suite (stubs, test API on 5180, React app on 5174), but a separate run and
// report, so accessibility findings never fail the business-workflow suite.

export default defineConfig({
  ...base,
  testDir: './e2e',
  reporter: [
    ['list'],
    ['html', { outputFolder: 'a11y-report', open: 'never' }],
    ['junit', { outputFile: 'a11y-results/junit.xml' }],
  ],
  outputDir: 'a11y-results/artifacts',
  use: { ...devices['Desktop Chrome'], baseURL: E2E.webUrl, trace: 'retain-on-failure', screenshot: 'on' },
  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    { name: 'a11y', testMatch: /.*\.a11y\.spec\.ts/, dependencies: ['setup'] },
  ],
});
