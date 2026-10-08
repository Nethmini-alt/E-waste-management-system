import type { Actor } from './api';
import { createHousehold, createReadyCollector, createStaff, ensureAdmin } from './accounts';
import { stubs } from './stubs';
import { submitEWaste, waitForWorkflowStatus, type SubmittedEWaste } from '../steps/a-submission';
import { approveWorkflow, waitForAssignedJob } from '../steps/b-collection';

export interface Cast {
  admin: Actor;
  staff: Actor;
  worker: Actor;
  household: Actor;
  collector: Actor;
  collectorId: string;
  disposeAll(): Promise<void>;
}

/** One fresh account per role, with the stub Matcher pointing at the new collector. */
export async function createCast(): Promise<Cast> {
  await stubs.reset();
  const admin = await ensureAdmin();
  const staff = await createStaff(admin, 'Management');
  const worker = await createStaff(admin, 'Worker');
  const household = await createHousehold();
  const { collector, collectorId } = await createReadyCollector();
  await stubs.configure({ matcherCollectorId: collectorId });
  return {
    admin, staff, worker, household, collector, collectorId,
    async disposeAll() {
      for (const a of [admin, staff, worker, household, collector]) await a.dispose();
    },
  };
}

/** Steps A and B up to a job assigned to the cast's collector (not yet accepted). */
export async function intakeToAssignedJob(cast: Cast): Promise<SubmittedEWaste & { jobId: string }> {
  const submitted = await submitEWaste(cast.household);
  await waitForWorkflowStatus(cast.staff, submitted.workflowId, 'PendingApproval');
  await approveWorkflow(cast.staff, submitted.workflowId);
  const jobId = await waitForAssignedJob(cast.staff, submitted.workflowId, cast.collectorId);
  return { ...submitted, jobId };
}
