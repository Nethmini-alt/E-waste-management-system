// Component B — Collection & Logistics (owner: Nethmini)
// After approval the Matcher recommends a collector, a job is created and
// assigned, and the collector accepts, starts and completes the pickup.

import { expect } from '@playwright/test';
import type { Actor } from '../support/api';
import { waitForWorkflowStatus } from './a-submission';

export interface CollectedJob {
  jobId: string;
  measuredWeightKg: number;
}

/** Admin/staff approve the paused workflow; the chain resumes with the Matcher. */
export async function approveWorkflow(reviewer: Actor, workflowId: string) {
  const res = await reviewer.call('POST', `/api/workflows/${workflowId}/approve`, { comments: 'E2E: approved by reviewer' });
  expect(res.message).toContain('Approved');
}

/** Waits for the job the workflow creates and checks it went to the expected collector. */
export async function waitForAssignedJob(reviewer: Actor, workflowId: string, collectorId: string): Promise<string> {
  const workflow = await waitForWorkflowStatus(reviewer, workflowId, 'Completed');
  expect(workflow.resultingJobId, 'workflow created a job').toBeTruthy();

  const matcher = JSON.parse(workflow.matcherResultJson);
  expect(matcher.RecommendedCollectorId ?? matcher.recommendedCollectorId).toBe(collectorId);

  const job = await reviewer.call('GET', `/api/v1/jobs/${workflow.resultingJobId}`);
  expect(job.status).toBe('Assigned');
  expect(job.collectorId).toBe(collectorId);
  expect(Number(job.pickupLatitude)).toBeCloseTo(6.9271, 3); // geocoded by the (stub) Photon service
  return workflow.resultingJobId;
}

/** The collector's side of the pickup: accept -> start -> complete with photo and weight. */
export async function collectJob(collector: Actor, jobId: string, measuredWeightKg = 11.8): Promise<CollectedJob> {
  const myJobs: any[] = await collector.call('GET', '/api/v1/jobs/my');
  expect(myJobs.map((j) => j.jobId), 'job appears in the collector app list').toContain(jobId);

  expect((await collector.call('PUT', `/api/v1/jobs/${jobId}/accept`)).status).toBe('Accepted');
  expect((await collector.call('PUT', `/api/v1/jobs/${jobId}/start`)).status).toBe('InProgress');

  const done = await collector.call('POST', `/api/v1/jobs/${jobId}/complete`, {
    photoUrl: 'https://example.com/e2e-pickup.jpg',
    measuredWeightKg,
    notes: 'E2E pickup',
  });
  expect(done.status).toBe('Completed');
  expect(Number(done.measuredWeightKg)).toBe(measuredWeightKg);

  return { jobId, measuredWeightKg };
}
