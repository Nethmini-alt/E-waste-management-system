import { expect, request, type APIRequestContext, type APIResponse } from '@playwright/test';
import { E2E } from '../env';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE';

/** A logged-in user of one role, with their own HTTP client carrying their JWT. */
export class Actor {
  constructor(
    readonly label: string,
    readonly role: string,
    readonly userId: string,
    readonly email: string,
    readonly password: string,
    readonly http: APIRequestContext,
  ) {}

  /** Sends a request and asserts the status code. Returns the parsed JSON body (or null). */
  async call<T = any>(method: Method, url: string, body?: unknown, expectedStatus = 200): Promise<T> {
    const res = await this.http.fetch(url, { method, data: body });
    await expectStatus(res, expectedStatus, `${this.label} ${method} ${url}`);
    return parseJson<T>(res);
  }

  /** Sends a request without asserting — for negative tests that check the status themselves. */
  async raw(method: Method, url: string, body?: unknown): Promise<APIResponse> {
    return this.http.fetch(url, { method, data: body });
  }

  async dispose() {
    await this.http.dispose();
  }
}

export async function expectStatus(res: APIResponse, expected: number, what: string) {
  if (res.status() !== expected) {
    const text = await res.text();
    expect(res.status(), `${what} → expected ${expected}, got ${res.status()}: ${text.slice(0, 800)}`).toBe(expected);
  }
}

async function parseJson<T>(res: APIResponse): Promise<T> {
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/** An HTTP client with no token — for public endpoints and 401 checks. */
export async function anonymous(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: E2E.apiUrl });
}

export async function login(label: string, email: string, password: string): Promise<Actor> {
  const anon = await anonymous();
  const res = await anon.post('/api/auth/login', { data: { email, password } });
  await expectStatus(res, 200, `${label} login`);
  const auth = await res.json();
  await anon.dispose();

  const http = await request.newContext({
    baseURL: E2E.apiUrl,
    extraHTTPHeaders: { Authorization: `Bearer ${auth.token}` },
  });
  return new Actor(label, auth.role, auth.userId, email, password, http);
}

/** Self-registration is only open to Household, Corporate and Collector. */
export async function registerAndLogin(
  label: string,
  role: 'Household' | 'Corporate' | 'Collector',
  email: string,
  password = 'Passw0rd!e2e',
): Promise<Actor> {
  const anon = await anonymous();
  const res = await anon.post('/api/auth/register', {
    data: { fullName: label, email, password, phone: '0771234567', role },
  });
  await expectStatus(res, 201, `${label} register`);
  await anon.dispose();
  return login(label, email, password);
}

/** A unique suffix so every run creates fresh accounts and never collides with old data. */
export function runId(): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
