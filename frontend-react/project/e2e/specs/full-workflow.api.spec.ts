// TC-E2E-001 — the complete business workflow across all four components,
// through the real API, real PostgreSQL and the real workflow orchestrator
// (only the external AI agents and OpenStreetMap are stubbed).
//
//   A  household submits  ->  Planner/Analyzer/Validator  ->  paused for approval
//   B  reviewer approves  ->  Matcher  ->  job assigned  ->  collector picks up
//   C  worker receives at the warehouse  ->  sorts  ->  dismantles to Copper (ReadyForSale)
//   D  staff sell the Copper to an active buyer  ->  order completed  ->  revenue recorded

import { expect, test } from '@playwright/test';
import { E2E } from '../env';
import { ensureAdmin, createHousehold, createReadyCollector, createStaff } from '../support/accounts';
import { stubs } from '../support/stubs';
import { expectSubmissionStatus, submitEWaste, waitForWorkflowStatus } from '../steps/a-submission';
import { approveWorkflow, collectJob, waitForAssignedJob } from '../steps/b-collection';
import { dismantleToMaterial, receiveDelivery } from '../steps/c-inventory';
import { sellMaterial } from '../steps/d-sales';

test('TC-E2E-001: submission → collection → warehouse processing → sale → revenue', async () => {
  // ---- Arrange: one fresh account per role ----
  await stubs.reset();
  const admin = await ensureAdmin();
  const staff = await createStaff(admin, 'Management');
  const worker = await createStaff(admin, 'Worker');
  const household = await createHousehold();
  const { collector, collectorId } = await createReadyCollector();
  await stubs.configure({ validator: 'approval', matcherCollectorId: collectorId });

  const trace: Record<string, unknown> = {};

  // ---- A: Generator & Submission ----
  const submitted = await test.step('A — household submits e-waste; agents analyse it and pause for approval', async () => {
    const submitted = await submitEWaste(household);
    const workflow = await waitForWorkflowStatus(staff, submitted.workflowId, 'PendingApproval');

    expect(workflow.approvalRequired).toBe(true);
    expect(JSON.parse(workflow.analyzerResultJson)).toMatchObject({ WasteCategory: 'IT Equipment', HazardLevel: 'Low' });
    expect(workflow.resultingJobId).toBeNull();
    await expectSubmissionStatus(household, submitted.submissionId, 'AwaitingReview');
    return submitted;
  });
  trace.submissionId = submitted.submissionId;
  trace.workflowId = submitted.workflowId;

  // ---- B: Collection & Logistics ----
  const jobId = await test.step('B — reviewer approves; Matcher assigns the collector; collector completes the pickup', async () => {
    await approveWorkflow(staff, submitted.workflowId);
    const jobId = await waitForAssignedJob(staff, submitted.workflowId, collectorId);
    await expectSubmissionStatus(household, submitted.submissionId, 'CollectorAssigned');

    await collectJob(collector, jobId, 11.8);
    await expectSubmissionStatus(household, submitted.submissionId, 'Collected');
    return jobId;
  });
  trace.jobId = jobId;

  await test.step('Agents were called once each, in the planned order', async () => {
    const calls = await stubs.callsFor(submitted.workflowId);
    expect(calls.map((c) => `${c.service} ${c.path}`)).toEqual([
      'planner /plan',
      'analyzer /run',
      'validator /run',
      'matcher /run',
      'planner /finalize',
    ]);
    // The Matcher got the geocoded pickup point and the Analyzer's weight estimate.
    const matcherCall = calls.find((c) => c.service === 'matcher')!;
    expect(matcherCall.body).toMatchObject({ pickupLatitude: 6.9271, pickupLongitude: 79.8612, estimatedWeightKg: 12, alreadyEscalated: true });
  });

  // ---- C: Processing & Inventory ----
  const material = await test.step('C — worker receives the delivery, sorts and dismantles it into Copper (ReadyForSale)', async () => {
    const unit = await receiveDelivery(worker, jobId, collectorId, 11.5, 'Laptop');
    trace.inventoryItemId = unit.inventoryItemId;
    trace.collectorPayment = unit.paymentAmount;
    return dismantleToMaterial(worker, unit.inventoryItemId, E2E.material, 2.5);
  });
  trace.materialItemId = material.materialItemId;

  // ---- D: Sales, Pricing & Export ----
  const sale = await test.step('D — staff sell 2 kg of the Copper; order completed; revenue recorded', async () => {
    return sellMaterial(staff, material.materialItemId, E2E.material, 2);
  });
  trace.salesOrderId = sale.salesOrderId;
  trace.revenue = sale.totalAmount;

  // Evidence: every id created along the way, attached to the HTML report.
  await test.info().attach('workflow-trace.json', { body: JSON.stringify(trace, null, 2), contentType: 'application/json' });

  for (const actor of [admin, staff, worker, household, collector]) await actor.dispose();
});
