import { request } from '@playwright/test';
import { E2E } from '../env';

export interface StubConfig {
  analyzer?: 'ok' | 'fail';
  validator?: 'approval' | 'auto';
  matcherCollectorId?: string | null;
}

export interface StubCall {
  service: 'planner' | 'analyzer' | 'validator' | 'matcher' | 'sales' | 'geo';
  path: string;
  body: any;
  at: string;
}

async function post(path: string, data?: unknown) {
  const ctx = await request.newContext({ baseURL: E2E.stubControlUrl });
  const res = await ctx.post(path, { data });
  if (!res.ok()) throw new Error(`stub control ${path} failed: ${res.status()}`);
  await ctx.dispose();
}

export const stubs = {
  reset: () => post('/__reset'),
  configure: (config: StubConfig) => post('/__control', config),

  /** Agent calls the API made for one workflow, in the order it made them. */
  async callsFor(workflowId: string): Promise<StubCall[]> {
    const ctx = await request.newContext({ baseURL: E2E.stubControlUrl });
    const all: StubCall[] = await (await ctx.get('/__calls')).json();
    await ctx.dispose();
    return all.filter((c) => c.body?.workflowId === workflowId);
  },
};
