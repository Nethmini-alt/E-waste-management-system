// TC-E2E-002 .. TC-E2E-006 — alternative paths, failure handling and the
// business rules that only show up when the components are joined together.

import { expect, test } from '@playwright/test';
import { E2E } from '../env';
import { anonymous } from '../support/api';
import { stubs } from '../support/stubs';
import { createCast, intakeToAssignedJob, type Cast } from '../support/workflow';
import { expectSubmissionStatus, submitEWaste, waitForWorkflowStatus } from '../steps/a-submission';
import { collectJob, waitForAssignedJob } from '../steps/b-collection';
import { firstWarehouseLocation, InventoryStatus, receiveDelivery } from '../steps/c-inventory';
import { availableQuantity, createActiveBuyer } from '../steps/d-sales';

let cast: Cast;
test.beforeEach(async () => { cast = await createCast(); });
test.afterEach(async () => { await cast.disposeAll(); });

test('TC-E2E-002: Analyzer agent down → workflow fails safely, no job, customer sees Failed', async () => {
  await stubs.configure({ analyzer: 'fail' });

  const submitted = await submitEWaste(cast.household);
  await waitForWorkflowStatus(cast.staff, submitted.workflowId, 'Failed');

  const workflow = await cast.staff.call('GET', `/api/workflows/${submitted.workflowId}`);
  expect(workflow.resultingJobId).toBeNull();
  expect(workflow.analyzerResultJson).toBeNull();

  const log: any[] = await cast.staff.call('GET', `/api/workflows/${submitted.workflowId}/execution-log`);
  const failure = log.find((l) => !l.succeeded);
  expect(failure, 'the failure is recorded in the execution log').toBeTruthy();
  expect(failure.errorMessage).toContain('Analyzer');

  // The chain stopped: Validator and Matcher were never called.
  const services = (await stubs.callsFor(submitted.workflowId)).map((c) => c.service);
  expect(services).not.toContain('validator');
  expect(services).not.toContain('matcher');

  await expectSubmissionStatus(cast.household, submitted.submissionId, 'Failed');
});

test('TC-E2E-003: reviewer rejects → workflow Rejected, Matcher never runs, no job', async () => {
  const submitted = await submitEWaste(cast.household);
  await waitForWorkflowStatus(cast.staff, submitted.workflowId, 'PendingApproval');

  await cast.staff.call('POST', `/api/workflows/${submitted.workflowId}/reject`, { comments: 'E2E: not collectable' });
  const workflow = await waitForWorkflowStatus(cast.staff, submitted.workflowId, 'Rejected');
  expect(workflow.resultingJobId).toBeNull();

  // A decided workflow cannot be approved afterwards.
  const again = await cast.staff.raw('POST', `/api/workflows/${submitted.workflowId}/approve`, { comments: 'too late' });
  expect(again.status()).toBe(400);

  expect((await stubs.callsFor(submitted.workflowId)).map((c) => c.service)).not.toContain('matcher');
  await expectSubmissionStatus(cast.household, submitted.submissionId, 'Rejected');
});

test('TC-E2E-004: Validator approves automatically → job assigned with no human step', async () => {
  await stubs.configure({ validator: 'auto' });

  const submitted = await submitEWaste(cast.household);
  const jobId = await waitForAssignedJob(cast.staff, submitted.workflowId, cast.collectorId);

  const workflow = await cast.staff.call('GET', `/api/workflows/${submitted.workflowId}`);
  expect(workflow.approvalRequired).toBe(false);
  expect(jobId).toBeTruthy();
  await expectSubmissionStatus(cast.household, submitted.submissionId, 'CollectorAssigned');
});

test('TC-E2E-005: business rules hold across component boundaries', async () => {
  const { jobId, submissionItemIds } = await intakeToAssignedJob(cast);
  const warehouseLocationId = await firstWarehouseLocation(cast.worker);
  // A valid delivery body, so each refusal below is caused by the rule under test only.
  const deliveryFor = (collectorId: string) => ({
    collectorId,
    warehouseLocationId,
    jobs: [{ jobId, items: submissionItemIds.map((id) => ({ submissionItemId: id, receivedQuantity: 1, itemType: 'Laptop', verifiedWeightKg: 5 })) }],
  });
  const expectRefused = async (res: import('@playwright/test').APIResponse, status: number, title: string) => {
    expect(res.status(), await res.text()).toBe(status);
    expect((await res.json()).title).toBe(title);
  };

  await test.step('B: collector cannot complete a job before accepting it', async () => {
    const res = await cast.collector.raw('POST', `/api/v1/jobs/${jobId}/complete`, { photoUrl: 'https://example.com/x.jpg', measuredWeightKg: 5 });
    expect(res.status()).toBe(409);
  });

  await test.step('C: warehouse cannot receive a job that has not been collected yet', async () => {
    const res = await cast.worker.raw('POST', '/api/v1/inventory/job-collection/receive-delivery', deliveryFor(cast.collectorId));
    await expectRefused(res, 409, 'Job not ready for receipt');
  });

  await collectJob(cast.collector, jobId);

  await test.step('C: a delivery must come from the collector who did the job', async () => {
    const other = await createCast();
    const res = await cast.worker.raw('POST', '/api/v1/inventory/job-collection/receive-delivery', deliveryFor(other.collectorId));
    await expectRefused(res, 409, 'Collector does not match the job');
    await other.disposeAll();
  });

  const unit = await receiveDelivery(cast.worker, jobId, cast.collectorId, 11.5, 'Laptop');

  await test.step('C: the same job cannot be received twice', async () => {
    const res = await cast.worker.raw('POST', '/api/v1/inventory/job-collection/receive-delivery', deliveryFor(cast.collectorId));
    await expectRefused(res, 409, 'Job already received');
  });

  await test.step('C: inventory cannot skip from Received straight to ReadyForSale', async () => {
    const res = await cast.worker.raw('PUT', `/api/v1/inventory/${unit.inventoryItemId}/status`, { nextStatus: InventoryStatus.ReadyForSale });
    expect(res.status()).toBe(409);
  });

  await cast.worker.call('PUT', `/api/v1/inventory/${unit.inventoryItemId}/status`, { nextStatus: InventoryStatus.Sorting });

  await test.step('C: dismantled outputs cannot weigh more than the unit (11.5 kg)', async () => {
    const res = await cast.worker.raw('POST', `/api/v1/inventory/${unit.inventoryItemId}/dismantle-log`, {
      description: 'too heavy', childItems: [], materials: [{ materialType: E2E.material, weightKg: 12, hazardous: false }],
    });
    expect(res.status()).toBe(400);
  });

  await test.step('C: a material Sales does not price cannot be recorded', async () => {
    const res = await cast.worker.raw('POST', `/api/v1/inventory/${unit.inventoryItemId}/dismantle-log`, {
      description: 'unknown', childItems: [], materials: [{ materialType: 'Unobtainium', weightKg: 1, hazardous: false }],
    });
    expect(res.status()).toBe(400);
  });

  const log = await cast.worker.call('POST', `/api/v1/inventory/${unit.inventoryItemId}/dismantle-log`, {
    description: 'E2E', childItems: [], materials: [{ materialType: E2E.material, weightKg: 1, hazardous: false }],
  });
  const materialItemId = log.materialInventoryItemIds[0];

  await test.step('D: cannot sell more than the recovered stock (1 kg)', async () => {
    expect(await availableQuantity(cast.staff, materialItemId)).toBeCloseTo(1, 3);
    const buyerId = await createActiveBuyer(cast.staff);
    const res = await cast.staff.raw('POST', '/api/sales-orders', {
      buyerId, items: [{ recoveredMaterialId: materialItemId, quantityKg: 1.5 }],
    });
    expect(res.status()).toBe(400);
    expect(await availableQuantity(cast.staff, materialItemId), 'failed order reserves nothing').toBeCloseTo(1, 3);
  });

  await test.step('D: a Pending (not activated) buyer cannot order', async () => {
    const anon = await anonymous();
    const reg = await anon.post('/api/buyers/register', {
      data: { fullName: 'Pending Buyer', email: `e2e.pending.${Date.now()}@ewaste.test`, password: 'Passw0rd!e2e',
        companyName: 'Pending Co', contactPerson: 'P', buyerType: 'Local' },
    });
    const pending = await reg.json();
    await anon.dispose();
    const res = await cast.staff.raw('POST', '/api/sales-orders', {
      buyerId: pending.buyerId, items: [{ recoveredMaterialId: materialItemId, quantityKg: 0.5 }],
    });
    expect(res.status()).toBe(400);
  });
});

test('TC-E2E-006: each role is limited to its own part of the workflow', async () => {
  const submitted = await submitEWaste(cast.household);
  await waitForWorkflowStatus(cast.staff, submitted.workflowId, 'PendingApproval');
  const approve = `/api/workflows/${submitted.workflowId}/approve`;

  const anon = await anonymous();
  expect((await anon.post(approve, { data: { comments: 'x' } })).status(), 'no token').toBe(401);
  await anon.dispose();

  expect((await cast.household.raw('POST', approve, { comments: 'x' })).status(), 'household approves').toBe(403);
  expect((await cast.worker.raw('POST', approve, { comments: 'x' })).status(), 'worker approves').toBe(403);
  expect((await cast.collector.raw('POST', approve, { comments: 'x' })).status(), 'collector approves').toBe(403);

  expect((await cast.collector.raw('GET', '/api/v1/inventory/job-collection/receivable')).status(), 'collector opens warehouse').toBe(403);
  expect((await cast.household.raw('GET', '/api/v1/inventory')).status(), 'household opens inventory').toBe(403);
  expect((await cast.worker.raw('POST', '/api/sales-orders', { buyerId: cast.worker.userId, items: [] })).status(), 'worker creates sales order').toBe(403);
  expect((await cast.staff.raw('POST', '/api/material-pricing', { materialType: 'Copper', pricePerKg: 1, effectiveDate: '2026-01-01' })).status(), 'staff sets prices (admin only)').toBe(403);

  // The workflow is still waiting — none of the refused calls changed it.
  await waitForWorkflowStatus(cast.staff, submitted.workflowId, 'PendingApproval');
});
