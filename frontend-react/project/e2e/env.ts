// G0 — one place for every URL, port and credential the E2E suite uses.
// Everything can be overridden with an environment variable, so CI and a
// teammate's laptop can point the same tests at a different setup.

import { localDbPassword } from './scripts/db-password.mjs';

export const E2E = {
  // The API instance started for the tests (NOT your dev API on 5172).
  apiUrl: process.env.E2E_API_URL ?? 'http://localhost:5180',

  // The React dev server started for the UI tests, pointed at apiUrl.
  webUrl: process.env.E2E_WEB_URL ?? 'http://localhost:5174',

  // Stub agents + stub OpenStreetMap (see stubs/agent-stubs.mjs).
  stubControlUrl: process.env.E2E_STUB_URL ?? 'http://localhost:18090',

  // Separate database so tests never touch demo data. Recreated on every run
  // unless E2E_KEEP_DB=1 (see scripts/start-api.mjs).
  dbName: process.env.E2E_DB_NAME ?? 'SmartEWasteDB_E2E',
  dbHost: process.env.E2E_DB_HOST ?? 'localhost',
  dbPort: Number(process.env.E2E_DB_PORT ?? 5432),
  dbUser: process.env.E2E_DB_USER ?? 'postgres',
  dbPassword: localDbPassword(),

  // Bootstrap admin. Admins cannot self-register, so the setup project
  // registers this user and promotes it to admin directly in the database.
  admin: {
    email: process.env.E2E_ADMIN_EMAIL ?? 'e2e.admin@ewaste.test',
    password: process.env.E2E_ADMIN_PASSWORD ?? 'E2eAdmin#2026',
    fullName: 'E2E Admin',
  },

  // Material the workflow dismantles out and sells. Setup makes sure an
  // Approved, live price exists for it.
  material: 'Copper',
  materialPricePerKg: 1500,
};

export const stubPorts = {
  control: 18090,
  planner: 18002,
  analyzer: 18003,
  validator: 18004,
  matcher: 18005,
  sales: 18001,
  geo: 18099,
};
