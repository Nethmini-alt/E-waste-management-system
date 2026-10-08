// G3 — Automated security tests (owner: Dinuri)
// Runs against the same isolated test API as the E2E suite (port 5180).
//
//   TC-SEC-001  Authentication: forged, tampered and missing tokens are rejected
//   TC-SEC-002  Authorization: every role reaches only its own endpoints (role × endpoint matrix)
//   TC-SEC-003  Object-level access: users cannot read or act on other users' records (IDOR)
//   TC-SEC-004  Machine-to-machine endpoints require the agent key
//   TC-SEC-005  Injection-style and oversized input is handled safely
//   TC-SEC-006  Brute-force protection on login
//   TC-SEC-011  Security headers on every API response (regression test for DEF-SEC-04, found by ZAP)

import crypto from 'node:crypto';
import fs from 'node:fs';
import { expect, request, test } from '@playwright/test';
import { E2E } from '../env';
import { anonymous, registerAndLogin, runId, type Actor } from '../support/api';
import { createCast, intakeToAssignedJob, type Cast } from '../support/workflow';
import { SAMPLE_SUBMISSION, submitEWaste } from '../steps/a-submission';

let cast: Cast;
test.beforeEach(async () => { cast = await createCast(); });
test.afterEach(async () => { await cast.disposeAll(); });

// ---------- helpers ----------

const b64url = (s: string | Buffer) => Buffer.from(s).toString('base64url');

/** Calls an endpoint with a raw Authorization header (or none). */
async function withToken(token: string | null, method: string, path: string, data?: unknown) {
  const ctx = await request.newContext({
    baseURL: E2E.apiUrl,
    extraHTTPHeaders: token === null ? {} : { Authorization: `Bearer ${token}` },
  });
  const res = await ctx.fetch(path, { method, data });
  const status = res.status();
  await ctx.dispose();
  return status;
}

async function tokenOf(actor: Actor): Promise<string> {
  const anon = await anonymous();
  const res = await anon.post('/api/auth/login', { data: { email: actor.email, password: actor.password } });
  const token = (await res.json()).token as string;
  await anon.dispose();
  return token;
}

// ---------- TC-SEC-001 ----------

test('TC-SEC-001: forged, tampered and missing tokens are rejected (401)', async () => {
  const realToken = await tokenOf(cast.household);
  const [header, payload, signature] = realToken.split('.');
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString());

  // Privilege escalation attempt: change the role claim to Admin but keep the old signature.
  const roleKey = Object.keys(claims).find((k) => k.toLowerCase().endsWith('role'))!;
  const escalated = `${header}.${b64url(JSON.stringify({ ...claims, [roleKey]: 'Admin' }))}.${signature}`;

  // "alg: none" attack: unsigned token.
  const unsigned = `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({ ...claims, [roleKey]: 'Admin' }))}.`;

  // Correct format, Admin role, but signed with an attacker's own key.
  const fakeHeader = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const fakeBody = b64url(JSON.stringify({ ...claims, [roleKey]: 'Admin' }));
  const fakeSig = crypto.createHmac('sha256', 'attacker-key-attacker-key-attacker-key!').update(`${fakeHeader}.${fakeBody}`).digest('base64url');
  const wrongKey = `${fakeHeader}.${fakeBody}.${fakeSig}`;

  // Expired-looking token: real header/signature, exp moved to the past (signature no longer matches).
  const expired = `${header}.${b64url(JSON.stringify({ ...claims, exp: 1_000_000_000 }))}.${signature}`;

  const adminOnly = '/api/v1/admin/staff';
  const ownData = '/api/v1/submissions/mine';

  // Control: the genuine token works on the household's own endpoint.
  expect(await withToken(realToken, 'GET', ownData), 'genuine token').toBe(200);

  for (const [label, token] of [
    ['no token', null],
    ['garbage token', 'not-a-jwt'],
    ['role changed to Admin, old signature', escalated],
    ['alg:none unsigned token', unsigned],
    ['Admin token signed with wrong key', wrongKey],
    ['modified expiry', expired],
  ] as const) {
    expect(await withToken(token, 'GET', adminOnly), `${label} → admin endpoint`).toBe(401);
    expect(await withToken(token, 'GET', ownData), `${label} → own data`).toBe(401);
  }
});

// ---------- TC-SEC-002 ----------

type Role = 'Admin' | 'Staff' | 'Worker' | 'Household' | 'Collector';

/** [method, path, roles that ARE allowed]. Every other role must get 403. All allowed calls are read-only. */
const MATRIX: Array<[string, string, Role[]]> = [
  ['GET', '/api/v1/submissions', ['Admin', 'Staff']],
  ['GET', '/api/v1/submissions/mine', ['Household']],
  ['GET', '/api/workflows', ['Admin', 'Staff']],
  ['GET', '/api/v1/jobs/my', ['Collector']],
  ['GET', '/api/v1/collectors', ['Admin', 'Staff']],
  ['GET', '/api/v1/inventory', ['Admin', 'Staff', 'Worker']],
  ['GET', '/api/v1/inventory/job-collection/receivable', ['Admin', 'Staff', 'Worker']],
  ['GET', '/api/v1/payments', ['Admin', 'Staff']],
  ['GET', '/api/material-pricing', ['Admin', 'Staff']],
  ['GET', '/api/sales-orders', ['Admin', 'Staff']],
  ['GET', '/api/export-orders', ['Admin', 'Staff']],
  ['GET', '/api/revenue', ['Admin', 'Staff']],
  ['GET', '/api/buyers', ['Admin', 'Staff']],
  ['GET', '/api/v1/admin/staff', ['Admin']],
  ['GET', '/api/v1/admin/admins', ['Admin']],
];

test('TC-SEC-002: role × endpoint access matrix (allowed → 200, everyone else → 403)', async () => {
  const actors: Record<Role, Actor> = {
    Admin: cast.admin, Staff: cast.staff, Worker: cast.worker, Household: cast.household, Collector: cast.collector,
  };
  const failures: string[] = [];
  const rows: string[] = [];

  for (const [method, path, allowed] of MATRIX) {
    const cells: string[] = [];
    for (const role of Object.keys(actors) as Role[]) {
      const status = (await actors[role].raw(method as any, path)).status();
      const expected = allowed.includes(role) ? 200 : 403;
      cells.push(`${role}:${status}`);
      if (status !== expected) failures.push(`${role} ${method} ${path} → ${status} (expected ${expected})`);
    }
    rows.push(`${method} ${path}  ${cells.join('  ')}`);
  }

  // Evidence: the full matrix as run, attached to the HTML report.
  await test.info().attach('authorization-matrix.txt', { body: rows.join('\n'), contentType: 'text/plain' });
  fs.writeFileSync(test.info().outputPath('authorization-matrix.txt'), rows.join('\n'));
  expect(failures, failures.join('\n')).toEqual([]);
});

// ---------- TC-SEC-003 ----------

test('TC-SEC-003: users cannot read or act on other users\' records (IDOR)', async () => {
  const { submissionId, jobId } = await intakeToAssignedJob(cast);
  const otherHousehold = await registerAndLogin('Household 2', 'Household', `e2e.household2.${runId()}@ewaste.test`);
  const other = await createCast(); // a second collector, unrelated to the job

  // Owner can read their own submission (control) …
  expect((await cast.household.raw('GET', `/api/v1/submissions/${submissionId}`)).status()).toBe(200);
  // … another household gets 404, which also hides that the record exists.
  expect((await otherHousehold.raw('GET', `/api/v1/submissions/${submissionId}`)).status()).toBe(404);

  // Another collector cannot view, accept, start or complete someone else's job.
  expect((await other.collector.raw('GET', `/api/v1/jobs/${jobId}`)).status()).toBe(403);
  expect((await other.collector.raw('PUT', `/api/v1/jobs/${jobId}/accept`)).status()).toBe(403);
  expect((await other.collector.raw('PUT', `/api/v1/jobs/${jobId}/reject`, { reason: 'not mine' })).status()).toBe(403);
  expect((await other.collector.raw('POST', `/api/v1/jobs/${jobId}/complete`, { photoUrl: 'https://e.com/x.jpg', measuredWeightKg: 1 })).status()).toBe(403);

  // The job is untouched.
  expect((await cast.staff.call('GET', `/api/v1/jobs/${jobId}`)).status).toBe('Assigned');

  // Another user cannot mark the collector's notification as read.
  const notes: any = await cast.collector.call('GET', '/api/notifications');
  const list: any[] = Array.isArray(notes) ? notes : notes.items ?? [];
  if (list.length > 0) {
    const id = list[0].id ?? list[0].notificationId;
    expect((await otherHousehold.raw('POST', `/api/notifications/${id}/read`)).status()).toBe(404);
  }

  await otherHousehold.dispose();
  await other.disposeAll();
});

// ---------- TC-SEC-004 ----------

test('TC-SEC-004: agent (machine-to-machine) endpoints refuse calls without the agent key', async () => {
  const anon = await anonymous();
  const endpoints: Array<[string, string, unknown?]> = [
    ['GET', '/api/agent/business-rules'],
    ['GET', '/api/agent/materials/available'],
    ['POST', '/api/v1/collectors/match', { pickupLatitude: 6.9, pickupLongitude: 79.8 }],
    ['POST', '/api/commercial-plans', {}],
  ];
  // The test API always runs with an agent key configured (scripts/start-api.mjs), so every
  // call without the right key must be refused with 401 — before the request body is validated.
  for (const [method, path, data] of endpoints) {
    for (const key of [undefined, 'wrong-key']) {
      const res = await anon.fetch(path, { method, data, headers: key ? { 'X-Agent-Key': key } : {} });
      expect(res.status(), `${method} ${path} with ${key ?? 'no'} key`).toBe(401);
    }
  }
  // A logged-in human user is not an agent either.
  expect((await cast.admin.raw('GET', '/api/agent/business-rules')).status()).toBe(401);

  // Positive control: with the correct key the same endpoint answers, so the 401s above
  // come from the key check and not from the endpoint being broken.
  const withKey = await anon.get('/api/agent/business-rules', { headers: { 'X-Agent-Key': E2E.agentKey } });
  expect(withKey.status(), 'correct agent key').toBe(200);
  await anon.dispose();
});

// ---------- TC-SEC-005 ----------

test('TC-SEC-005: injection-style and oversized input is handled safely', async () => {
  // SQL-injection-style search text is treated as plain text: no error, no data leak.
  for (const search of [`' OR '1'='1`, `'; DROP TABLE inventory_items; --`, `%' UNION SELECT * FROM users --`]) {
    const res = await cast.staff.raw('GET', `/api/v1/inventory?search=${encodeURIComponent(search)}`);
    expect(res.status(), `search ${search}`).toBe(200);
    const body = await res.json();
    expect(body.items ?? body.Items ?? [], `search ${search} returns no rows`).toHaveLength(0);
  }
  // The table still exists afterwards.
  expect((await cast.staff.raw('GET', '/api/v1/inventory')).status()).toBe(200);

  // Script text is stored and returned as data, never interpreted by the API.
  const xss = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
  const created = await submitEWaste(cast.household, {
    ...SAMPLE_SUBMISSION,
    items: [{ itemName: 'Laptop', description: xss, imageUrl: '' }],
  });
  const stored = await cast.household.call('GET', `/api/v1/submissions/${created.submissionId}`);
  expect(stored.items[0].description).toBe(xss);

  // Validation limits (boundary values) are enforced server-side, not only in the UI.
  const tooLong = await cast.household.raw('POST', '/api/v1/submissions', { ...SAMPLE_SUBMISSION, pickupAddress: 'a'.repeat(301) });
  expect(tooLong.status(), 'address 301 chars').toBe(400);
  const tooMany = await cast.household.raw('POST', '/api/v1/submissions', {
    ...SAMPLE_SUBMISSION, items: Array.from({ length: 4 }, (_, i) => ({ itemName: `i${i}`, description: 'd', imageUrl: '' })),
  });
  expect(tooMany.status(), '4 items (max 3)').toBe(400);
  const badUrl = await cast.household.raw('POST', '/api/v1/submissions', {
    ...SAMPLE_SUBMISSION, items: [{ itemName: 'x', description: 'd', imageUrl: 'javascript:alert(1)' }],
  });
  expect(badUrl.status(), 'javascript: image URL').toBe(400);

  // Self-registration cannot create privileged accounts.
  const anon = await anonymous();
  for (const role of ['Admin', 'Staff']) {
    const res = await anon.post('/api/auth/register', {
      data: { fullName: 'x', email: `e2e.escalate.${runId()}@ewaste.test`, password: 'Passw0rd!e2e', role },
    });
    expect(res.status(), `self-register as ${role}`).toBe(400);
  }
  await anon.dispose();
});

// ---------- TC-SEC-006 ----------

test('TC-SEC-006: login is protected against password guessing (brute force)', async () => {
  const anon = await anonymous();
  const { email, password } = cast.household;

  const statuses: number[] = [];
  for (let i = 0; i < 10; i++) {
    const res = await anon.post('/api/auth/login', { data: { email, password: `wrong-guess-${i}` } });
    statuses.push(res.status());
  }
  await test.info().attach('wrong-attempt-statuses.txt', { body: statuses.join(', '), contentType: 'text/plain' });

  // After 10 wrong guesses in a row, the account (or caller) must be slowed down or locked:
  // the next attempt — even with the CORRECT password — should be refused (429 or 401/423 lockout).
  const afterGuessing = await anon.post('/api/auth/login', { data: { email, password } });
  expect(afterGuessing.status(), 'login right after 10 wrong guesses').not.toBe(200);
  await anon.dispose();
});

// ---------- TC-SEC-011 ----------

test('TC-SEC-011: security headers are sent on every API response, including errors', async () => {
  const anon = await anonymous();
  const responses: Array<[string, import('@playwright/test').APIResponse]> = [
    ['200 health check', await anon.get('/healthz')],
    ['200 JSON data', await cast.staff.raw('GET', '/api/v1/inventory')],
    ['401 no token', await anon.get('/api/v1/inventory')],
    ['400 invalid login', await anon.post('/api/auth/login', { data: {} })],
    ['404 unknown id', await cast.staff.raw('GET', `/api/v1/inventory/${crypto.randomUUID()}`)],
  ];
  for (const [label, res] of responses) {
    const h = res.headers();
    expect(h['x-content-type-options'], `${label}: X-Content-Type-Options`).toBe('nosniff');
    expect(h['x-frame-options'], `${label}: X-Frame-Options`).toBe('DENY');
    expect(h['referrer-policy'], `${label}: Referrer-Policy`).toBe('no-referrer');
  }
  await anon.dispose();
});
