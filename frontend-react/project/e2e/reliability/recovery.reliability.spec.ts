// G4 — Reliability and recovery testing (owner: Nethmini)
//
// The intake workflow runs in the background from an IN-MEMORY queue, so an
// API crash loses whatever was in flight. WorkflowStartupRecovery re-queues
// interrupted workflows on startup, and RunChainAsync resumes from the stored
// status. These tests check that against the real system: a real API process
// is hard-killed mid-workflow and restarted on the same PostgreSQL database.
//
//   TC-REL-001  crash while an agent call is in flight -> resumes, no repeated steps
//   TC-REL-002  crash while waiting for human approval -> still waiting, approve works
//   TC-REL-003  crash after the job was created -> nothing re-runs, no duplicate job
//   TC-REL-004  an agent hangs (no crash) -> timeout ends the workflow safely

import { expect, test } from '@playwright/test';
import pg from 'pg';
import { E2E } from '../env';
import { TestApi } from '../support/api-process';
import { stubs, type StubCall } from '../support/stubs';
import { createCast, intakeToAssignedJob, type Cast } from '../support/workflow';
import { submitEWaste, waitForWorkflowStatus } from '../steps/a-submission';
import { approveWorkflow, waitForAssignedJob } from '../steps/b-collection';

test.describe.configure({ mode: 'serial' });

const api = new TestApi();
let cast: Cast;

test.beforeAll(async () => {
  test.setTimeout(360_000); // the first start builds the API
  await api.start({ fresh: true });
});
test.afterAll(async () => { await api.stop(); });
test.beforeEach(async () => { cast = await createCast(); });
test.afterEach(async () => { await cast?.disposeAll(); });

/** Which agent endpoints were called for this workflow, e.g. ['planner /plan', 'analyzer /run']. */
async function agentCalls(workflowId: string): Promise<string[]> {
  return (await stubs.callsFor(workflowId)).map((c: StubCall) => `${c.service} ${c.path}`);
}
const count = (calls: string[], call: string) => calls.filter((c) => c === call).length;

/** Jobs in the database for one submission — checks for duplicates directly. */
async function jobCount(submissionId: string): Promise<number> {
  const client = new pg.Client({
    host: E2E.dbHost, port: E2E.dbPort, user: E2E.dbUser, password: E2E.dbPassword, database: E2E.dbName,
  });
  await client.connect();
  const { rows } = await client.query('SELECT count(*)::int AS n FROM jobs WHERE submission_id = $1', [submissionId]);
  await client.end();
  return rows[0].n;
}

async function crashAndRestart() {
  await test.step('crash the API (hard kill) and start it again', async () => {
    await api.crash();
    await api.start();
  });
}

test('TC-REL-001: API crashes while an agent call is in flight → workflow resumes after restart, no step repeated', async () => {
  await stubs.configure({ analyzer: 'hang' });
  const submitted = await submitEWaste(cast.household);
  const wf = submitted.workflowId;

  await test.step('workflow is stuck mid-chain, waiting on the Analyzer', async () => {
    await waitForWorkflowStatus(cast.staff, wf, 'Analyzing');
    await expect.poll(async () => count(await agentCalls(wf), 'analyzer /run')).toBe(1);
  });

  await stubs.configure({ analyzer: 'ok' }); // the agent is healthy again when the API comes back
  await crashAndRestart();

  await test.step('startup recovery re-queues it and the chain carries on', async () => {
    await waitForWorkflowStatus(cast.staff, wf, 'PendingApproval', 60_000);
  });

  await test.step('resumed from the stored status: Planner not re-run, only the interrupted step repeated', async () => {
    const calls = await agentCalls(wf);
    expect(count(calls, 'planner /plan'), calls.join(', ')).toBe(1);
    expect(count(calls, 'analyzer /run'), 'interrupted call + the retry after restart').toBe(2);
    expect(count(calls, 'validator /run')).toBe(1);
  });

  await test.step('the recovered workflow completes normally: one job, assigned', async () => {
    await approveWorkflow(cast.staff, wf);
    await waitForAssignedJob(cast.staff, wf, cast.collectorId);
    expect(await jobCount(submitted.submissionId)).toBe(1);
  });
});

test('TC-REL-002: API crashes while a workflow waits for human approval → still waiting after restart, approval works', async () => {
  const submitted = await submitEWaste(cast.household);
  const wf = submitted.workflowId;
  await waitForWorkflowStatus(cast.staff, wf, 'PendingApproval');
  const callsBefore = await agentCalls(wf);

  await crashAndRestart();

  await test.step('not re-run by recovery: same status, no new agent calls', async () => {
    // Give the startup recovery and queue processor time to do anything they would do.
    await new Promise((r) => setTimeout(r, 3_000));
    const workflow = await cast.staff.call('GET', `/api/workflows/${wf}`);
    expect(workflow.status).toBe('PendingApproval');
    expect(await agentCalls(wf)).toEqual(callsBefore);
  });

  await test.step('data survived: the household still sees the submission', async () => {
    const submission = await cast.household.call('GET', `/api/v1/submissions/${submitted.submissionId}`);
    expect(submission.id).toBe(submitted.submissionId);
  });

  await test.step('reviewer approves after the restart → job assigned once', async () => {
    await approveWorkflow(cast.staff, wf);
    await waitForAssignedJob(cast.staff, wf, cast.collectorId);
    expect(await jobCount(submitted.submissionId)).toBe(1);
  });
});

test('TC-REL-003: API crashes after the job was created → nothing re-runs, no duplicate job, collector carries on', async () => {
  const { submissionId, workflowId, jobId } = await intakeToAssignedJob(cast);
  const callsBefore = await agentCalls(workflowId);

  await crashAndRestart();

  await test.step('completed workflow left alone', async () => {
    await new Promise((r) => setTimeout(r, 3_000));
    const workflow = await cast.staff.call('GET', `/api/workflows/${workflowId}`);
    expect(workflow.status).toBe('Completed');
    expect(workflow.resultingJobId).toBe(jobId);
    expect(await agentCalls(workflowId)).toEqual(callsBefore);
    expect(await jobCount(submissionId)).toBe(1);
  });

  await test.step('the job survived and the collector can continue with it', async () => {
    const job = await cast.staff.call('GET', `/api/v1/jobs/${jobId}`);
    expect(job.status).toBe('Assigned');
    expect(job.collectorId).toBe(cast.collectorId);
    expect((await cast.collector.call('PUT', `/api/v1/jobs/${jobId}/accept`)).status).toBe('Accepted');
  });
});

test('TC-REL-004: an agent hangs (no crash) → request times out and the workflow fails safely', async () => {
  // AnalyzerAgentClient has a 60 s HttpClient timeout; without it the workflow would wait forever.
  await stubs.configure({ analyzer: 'hang' });
  const submitted = await submitEWaste(cast.household);
  const wf = submitted.workflowId;

  const started = Date.now();
  await waitForWorkflowStatus(cast.staff, wf, 'Failed', 120_000);
  const seconds = Math.round((Date.now() - started) / 1000);
  test.info().annotations.push({ type: 'time to fail', description: `${seconds} s` });

  await test.step('failure recorded, chain stopped, no job', async () => {
    const workflow = await cast.staff.call('GET', `/api/workflows/${wf}`);
    expect(workflow.resultingJobId).toBeNull();
    const log: any[] = await cast.staff.call('GET', `/api/workflows/${wf}/execution-log`);
    expect(log.find((l) => !l.succeeded), 'the failure is in the execution log').toBeTruthy();
    expect(await agentCalls(wf)).not.toContain('validator /run');
    expect(await jobCount(submitted.submissionId)).toBe(0);
  });

  await test.step('the API stays usable: a new submission goes through once the agent is back', async () => {
    await stubs.configure({ analyzer: 'ok' });
    const next = await submitEWaste(cast.household);
    await waitForWorkflowStatus(cast.staff, next.workflowId, 'PendingApproval', 60_000);
  });
});
