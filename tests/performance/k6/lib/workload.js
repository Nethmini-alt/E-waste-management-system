// What a "virtual user" does, shared by smoke / load / stress / spike.
//
// setupAccounts() runs ONCE before the test: it logs in as the admin and
// creates one account per role, so every virtual user reuses those tokens.
// userJourney() runs over and over for each virtual user: a realistic mix of
// the main read screens of all four components, plus an occasional login.

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { ADMIN, BASE_URL, PASSWORD } from './config.js';

const json = { headers: { 'Content-Type': 'application/json' } };
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

function login(email, password) {
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({ email, password }), {
    ...json, tags: { name: 'POST /api/auth/login', type: 'login' },
  });
  check(res, { 'login 200': (r) => r.status === 200 });
  return res.json('token');
}

function register(role) {
  const email = `perf.${role.toLowerCase()}.${Date.now()}${Math.floor(Math.random() * 1e6)}@ewaste.test`;
  const res = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
    fullName: `Perf ${role}`, email, password: PASSWORD, phone: '0771234567', role,
  }), json);
  if (res.status !== 201) throw new Error(`register ${role} failed: ${res.status} ${res.body}`);
  return { email, token: login(email, PASSWORD) };
}

export function setupAccounts() {
  const health = http.get(`${BASE_URL}/healthz`);
  if (health.status !== 200) throw new Error(`API not reachable at ${BASE_URL} — start it first (see README)`);

  const adminToken = login(ADMIN.email, ADMIN.password);
  if (!adminToken) throw new Error('Admin login failed — run `npm run e2e` once first so the admin exists (see README)');

  // Management staff (web app role "Staff") — created by the admin.
  const staffEmail = `perf.staff.${Date.now()}@ewaste.test`;
  const res = http.post(`${BASE_URL}/api/v1/admin/staff`, JSON.stringify({
    fullName: 'Perf Staff', email: staffEmail, password: PASSWORD, phone: '0771111111', staffType: 0,
  }), { headers: { ...json.headers, Authorization: `Bearer ${adminToken}` } });
  if (res.status !== 201) throw new Error(`create staff failed: ${res.status} ${res.body}`);

  const household = register('Household');
  const collector = register('Collector');
  // A collector has a job list only after creating their vehicle profile (as the app's onboarding does).
  const profile = http.post(`${BASE_URL}/api/v1/collectors`, JSON.stringify({ vehicleType: 'Lorry', capacityKg: 500 }), {
    headers: { ...json.headers, Authorization: `Bearer ${collector.token}` },
  });
  if (profile.status !== 201) throw new Error(`create collector profile failed: ${profile.status} ${profile.body}`);

  return {
    staffToken: login(staffEmail, PASSWORD),
    householdToken: household.token,
    householdEmail: household.email,
    collectorToken: collector.token,
  };
}

function get(path, token, name) {
  const res = http.get(`${BASE_URL}${path}`, { ...auth(token), tags: { name, type: 'read' } });
  check(res, { [`${name} 200`]: (r) => r.status === 200 });
  return res;
}

export function userJourney(data) {
  group('A - household: my submissions', () => {
    get('/api/v1/submissions/mine', data.householdToken, 'GET /api/v1/submissions/mine');
  });
  group('B - collector: my jobs', () => {
    get('/api/v1/jobs/my', data.collectorToken, 'GET /api/v1/jobs/my');
  });
  group('C - staff: inventory', () => {
    get('/api/v1/inventory?page=1&pageSize=20', data.staffToken, 'GET /api/v1/inventory');
    get('/api/v1/inventory/recovered-materials', data.staffToken, 'GET /api/v1/inventory/recovered-materials');
  });
  group('D - staff: sales', () => {
    get('/api/recovered-materials/available', data.staffToken, 'GET /api/recovered-materials/available');
    get('/api/sales-orders', data.staffToken, 'GET /api/sales-orders');
    get('/api/revenue/summary', data.staffToken, 'GET /api/revenue/summary');
  });

  // About 1 in 10 iterations also signs in again (password hashing is CPU-heavy).
  if (Math.random() < 0.1) {
    group('Auth - login', () => login(data.householdEmail, PASSWORD));
  }

  sleep(1); // "think time" between screens, like a real user
}
