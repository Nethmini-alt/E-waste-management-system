// G0 — starts a dedicated API instance for the E2E run.
//
// Why not just `dotnet run`?
//  - Your dev API may already be running from the same project and holding
//    bin/Debug locked, so this builds a Release copy into e2e/.api-build.
//  - The test instance must use its own database and talk to the stubs, not
//    the real agents/OpenStreetMap. That is all done with environment
//    variables, so appsettings.json is never edited.
//
// The E2E database is dropped first so every run starts clean (EF migrations
// recreate it on startup). Set E2E_KEEP_DB=1 to keep the data between runs.

import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { localDbPassword } from './db-password.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiProject = path.resolve(here, '../../../../backend/EWasteManagement.API');
const outDir = path.resolve(here, '../.api-build');

const db = {
  host: process.env.E2E_DB_HOST ?? 'localhost',
  port: Number(process.env.E2E_DB_PORT ?? 5432),
  user: process.env.E2E_DB_USER ?? 'postgres',
  password: localDbPassword(),
  name: process.env.E2E_DB_NAME ?? 'SmartEWasteDB_E2E',
};
const apiUrl = process.env.E2E_API_URL ?? 'http://localhost:5180';
const stub = (name, fallback) => `http://localhost:${process.env[name] ?? fallback}`;

if (!/^[A-Za-z0-9_]+$/.test(db.name)) throw new Error(`Unsafe database name: ${db.name}`);
if (!db.name.toUpperCase().includes('E2E')) throw new Error(`Refusing to drop a database without "E2E" in its name: ${db.name}`);

if (process.env.E2E_KEEP_DB !== '1') {
  const client = new pg.Client({ host: db.host, port: db.port, user: db.user, password: db.password, database: 'postgres' });
  await client.connect();
  await client.query(`DROP DATABASE IF EXISTS "${db.name}" WITH (FORCE)`);
  await client.end();
  console.log(`[e2e] dropped database ${db.name} (fresh run)`);
}

console.log('[e2e] building API (Release) ...');
const build = spawnSync('dotnet', ['build', apiProject, '-c', 'Release', '-o', outDir, '--nologo', '-v', 'q'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (build.status !== 0) process.exit(build.status ?? 1);

const env = {
  ...process.env,
  ASPNETCORE_ENVIRONMENT: 'Development',
  ASPNETCORE_URLS: apiUrl,
  ConnectionStrings__DefaultConnection:
    `Host=${db.host};Port=${db.port};Database=${db.name};Username=${db.user};Password=${db.password}`,
  // A fixed agent key, so agent-only endpoints behave the same on every machine and in CI
  // (the committed appsettings.json has an empty key, and local copies differ).
  Agent__ApiKey: process.env.E2E_AGENT_KEY ?? 'e2e-test-agent-key',
  Agent__BaseUrl: stub('E2E_STUB_SALES_PORT', 18001),
  Agent__PlannerBaseUrl: stub('E2E_STUB_PLANNER_PORT', 18002),
  Agent__AnalyzerBaseUrl: stub('E2E_STUB_ANALYZER_PORT', 18003),
  Agent__ValidatorBaseUrl: stub('E2E_STUB_VALIDATOR_PORT', 18004),
  Agent__MatcherBaseUrl: stub('E2E_STUB_MATCHER_PORT', 18005),
  OpenStreetMap__PhotonBaseUrl: `${stub('E2E_STUB_GEO_PORT', 18099)}/api`,
  OpenStreetMap__OsrmBaseUrl: stub('E2E_STUB_GEO_PORT', 18099),
  Storage__Provider: 'Local',
  Storage__PublicBaseUrl: apiUrl,
};
// A DATABASE_URL in the shell would override the connection string in Program.cs.
delete env.DATABASE_URL;

console.log(`[e2e] starting API on ${apiUrl} with database ${db.name}`);
// cwd = build output, so appsettings.json there is the content root's config.
const api = spawn('dotnet', [path.join(outDir, 'EWasteManagement.API.dll')], { cwd: outDir, env, stdio: 'inherit' });

const stop = () => api.kill();
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
process.on('exit', stop);
api.on('exit', (code) => process.exit(code ?? 0));
