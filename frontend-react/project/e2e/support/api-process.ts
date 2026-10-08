// G4 — lets a reliability test own its API process: start it, crash it
// (hard kill, like a power cut or an OOM kill), and start it again on the same
// database. Uses the same G0 launcher (scripts/start-api.mjs), so the instance
// talks to the stub agents and its own E2E database exactly like the E2E run.

import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { request } from '@playwright/test';
import { E2E } from '../env';

const launcher = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../scripts/start-api.mjs');

async function healthy(): Promise<boolean> {
  const ctx = await request.newContext({ baseURL: E2E.apiUrl, timeout: 2_000 });
  try {
    return (await ctx.get('/healthz')).ok();
  } catch {
    return false;
  } finally {
    await ctx.dispose();
  }
}

async function waitUntil(condition: () => Promise<boolean>, timeoutMs: number, what: string) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await condition()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out after ${timeoutMs} ms waiting for ${what}`);
}

export class TestApi {
  private proc: ChildProcess | null = null;
  /** How many times the API has been started — shown in the report. */
  starts = 0;

  /** Starts the API. `fresh` drops and recreates the database first. */
  async start({ fresh = false } = {}) {
    if (await healthy()) throw new Error(`something is already listening on ${E2E.apiUrl} — stop it first`);

    this.proc = spawn(process.execPath, [launcher], {
      env: { ...process.env, E2E_KEEP_DB: fresh ? '0' : '1' },
      stdio: 'ignore',
      // Own process group on Linux/macOS, so crash() can kill node AND dotnet together.
      detached: process.platform !== 'win32',
    });
    this.starts += 1;
    // First start builds the API (Release), which can take a minute or two.
    await waitUntil(healthy, 300_000, `API on ${E2E.apiUrl} to become healthy`);
  }

  /** Hard-kills the API and everything it started. No graceful shutdown runs. */
  async crash() {
    const pid = this.proc?.pid;
    if (!pid) throw new Error('API is not running');
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/pid', String(pid), '/T', '/F']);
    } else {
      process.kill(-pid, 'SIGKILL');
    }
    this.proc = null;
    await waitUntil(async () => !(await healthy()), 30_000, 'API to go down');
  }

  async stop() {
    if (this.proc) await this.crash();
  }
}
