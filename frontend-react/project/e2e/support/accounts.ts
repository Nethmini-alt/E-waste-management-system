import pg from 'pg';
import { E2E } from '../env';
import { Actor, anonymous, expectStatus, login, registerAndLogin, runId } from './api';

/**
 * Admins cannot self-register and no admin is seeded by migrations, so the
 * bootstrap admin is registered as a Household user and then promoted in the
 * E2E database. This is the only place the tests write to the DB directly.
 */
export async function ensureAdmin(): Promise<Actor> {
  const { email, password, fullName } = E2E.admin;

  const anon = await anonymous();
  const existing = await anon.post('/api/auth/login', { data: { email, password } });
  const alreadyAdmin = existing.ok() && (await existing.json()).role === 'Admin';

  if (!alreadyAdmin) {
    if (!existing.ok()) {
      const res = await anon.post('/api/auth/register', {
        data: { fullName, email, password, phone: '0770000000', role: 'Household' },
      });
      await expectStatus(res, 201, 'bootstrap admin register');
    }
    const client = new pg.Client({
      host: E2E.dbHost, port: E2E.dbPort, user: E2E.dbUser, password: E2E.dbPassword, database: E2E.dbName,
    });
    await client.connect();
    await client.query(`UPDATE users SET role = 'admin', staff_type = NULL WHERE email = $1`, [email]);
    await client.end();
  }
  await anon.dispose();
  return login('Admin', email, password);
}

/** StaffType enum on the API: 0 = Management (web, role "Staff"), 1 = Worker (Flutter, role "Worker"). */
export async function createStaff(admin: Actor, kind: 'Management' | 'Worker'): Promise<Actor> {
  const email = `e2e.${kind.toLowerCase()}.${runId()}@ewaste.test`;
  const password = 'Passw0rd!e2e';
  await admin.call('POST', '/api/v1/admin/staff', {
    fullName: `E2E ${kind}`,
    email,
    password,
    phone: '0771111111',
    staffType: kind === 'Management' ? 0 : 1,
  }, 201);
  return login(kind === 'Management' ? 'Staff' : 'Worker', email, password);
}

export async function createHousehold(): Promise<Actor> {
  return registerAndLogin('Household', 'Household', `e2e.household.${runId()}@ewaste.test`);
}

/** A collector who is online, positioned at the stub pickup point, with room for the job. */
export async function createReadyCollector(): Promise<{ collector: Actor; collectorId: string }> {
  const collector = await registerAndLogin('Collector', 'Collector', `e2e.collector.${runId()}@ewaste.test`);
  const profile = await collector.call('POST', '/api/v1/collectors', { vehicleType: 'Lorry', capacityKg: 500 }, 201);
  const collectorId: string = profile.collectorId;
  await collector.call('PUT', `/api/v1/collectors/${collectorId}/availability`, { isAvailable: true });
  await collector.call('PUT', `/api/v1/collectors/${collectorId}/location`, { latitude: 6.9271, longitude: 79.8612 });
  return { collector, collectorId };
}
