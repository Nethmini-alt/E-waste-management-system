// Component A — Generator & Submission (owner: Dinuri)
// A household submits e-waste; the API starts the agent workflow
// (Planner -> Analyzer -> Validator), which pauses for human approval.

import { expect } from '@playwright/test';
import type { Actor } from '../support/api';

export interface SubmittedEWaste {
  submissionId: string;
  workflowId: string;
  submissionItemIds: string[];
}

export const SAMPLE_SUBMISSION = {
  source: 'Manual',
  category: 'IT Equipment',
  estimatedWeight: 12,
  pickupAddress: 'No 10, Galle Road, Colombo 03',
  phoneNumber: '0771234567',
  items: [{ itemName: 'Old laptop', description: 'Dell laptop, cracked screen, still boots', imageUrl: '' }],
};

export async function submitEWaste(household: Actor, payload = SAMPLE_SUBMISSION): Promise<SubmittedEWaste> {
  const created = await household.call('POST', '/api/v1/submissions', payload, 201);

  expect(created.id, 'submission id').toBeTruthy();
  expect(created.userId).toBe(household.userId);
  expect(created.category).toBe(payload.category);
  expect(created.items).toHaveLength(payload.items.length);
  // Submission and workflow are saved together, so the workflow exists immediately.
  expect(created.workflow?.workflowId, 'workflow created with the submission').toBeTruthy();

  return {
    submissionId: created.id,
    workflowId: created.workflow.workflowId,
    submissionItemIds: created.items.map((i: any) => i.id),
  };
}

/** Polls the workflow (as staff/admin) until it reaches the wanted status. */
export async function waitForWorkflowStatus(reviewer: Actor, workflowId: string, status: string, timeoutMs = 30_000) {
  let workflow: any;
  await expect
    .poll(async () => {
      workflow = await reviewer.call('GET', `/api/workflows/${workflowId}`);
      return workflow.status;
    }, { message: `workflow ${workflowId} to reach ${status}`, timeout: timeoutMs, intervals: [250, 500, 1000] })
    .toBe(status);
  return workflow;
}

/** The household sees its own submission status, derived from the workflow/job. */
export async function expectSubmissionStatus(household: Actor, submissionId: string, status: string) {
  const submission = await household.call('GET', `/api/v1/submissions/${submissionId}`);
  expect(submission.status).toBe(status);
  return submission;
}
