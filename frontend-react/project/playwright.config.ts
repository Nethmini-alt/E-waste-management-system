import { defineConfig, devices } from '@playwright/test';
import { E2E } from './e2e/env';

// G0/G1 — integrated end-to-end tests for the whole E-Waste system.
// `npm run e2e` starts everything it needs (stub agents, a dedicated API on
// port 5180 with its own database, and the React app on 5174), runs the
// tests, and writes the evidence listed in e2e/README.md.

export default defineConfig({
  testDir: './e2e',
  // One workflow at a time: the stub Matcher is configured per test.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { outputFolder: 'e2e-report', open: 'never' }],
    ['junit', { outputFile: 'e2e-results/junit.xml' }],
    ['json', { outputFile: 'e2e-results/results.json' }],
  ],
  outputDir: 'e2e-results/artifacts',

  use: {
    trace: 'on',
    screenshot: 'on',
    video: 'on',
  },

  projects: [
    { name: 'setup', testMatch: /setup\/.*\.setup\.ts/ },
    { name: 'api-e2e', testMatch: /.*\.api\.spec\.ts/, dependencies: ['setup'] },
    // G3 — automated security tests (e2e/specs/security.sec.spec.ts)
    { name: 'security', testMatch: /.*\.sec\.spec\.ts/, dependencies: ['setup'] },
    {
      name: 'ui-e2e',
      testMatch: /.*\.ui\.spec\.ts/,
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], baseURL: E2E.webUrl },
    },
  ],

  webServer: [
    {
      command: 'node e2e/stubs/agent-stubs.mjs',
      url: `${E2E.stubControlUrl}/__health`,
      reuseExistingServer: !process.env.CI,
      stdout: 'pipe',
    },
    {
      command: 'node e2e/scripts/start-api.mjs',
      url: `${E2E.apiUrl}/healthz`,
      reuseExistingServer: !process.env.CI,
      timeout: 300_000,
      stdout: 'pipe',
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: E2E.webUrl,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_BASE_URL: E2E.apiUrl },
      timeout: 120_000,
    },
  ],
});
