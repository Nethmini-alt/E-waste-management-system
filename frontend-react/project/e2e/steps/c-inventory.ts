// Component C — Processing & Inventory (owner: Manodya)
// A warehouse worker receives the collector's delivery, sorts the unit,
// dismantles it into a sellable material, which becomes ReadyForSale.

import { expect } from '@playwright/test';
import type { Actor } from '../support/api';

/** InventoryStatus enum numbers on the API (Features/Processing/Entities/Enums.cs). */
export const InventoryStatus = { Received: 0, Sorting: 1, Dismantling: 2, Classified: 3, ReadyForSale: 4 } as const;

export interface ReceivedUnit {
  inventoryItemId: string;
  warehouseLocationId: string;
  paymentAmount: number;
}

export interface RecoveredMaterial {
  materialItemId: string;
  materialType: string;
  weightKg: number;
}

export async function firstWarehouseLocation(worker: Actor): Promise<string> {
  const locations: any[] = await worker.call('GET', '/api/v1/inventory/lookups/warehouse-locations');
  expect(locations.length, 'seeded warehouse locations').toBeGreaterThan(0);
  return locations[0].id;
}

/** Receive the completed job at the warehouse, item by item, as the worker app does. */
export async function receiveDelivery(
  worker: Actor, jobId: string, collectorId: string, verifiedWeightKg = 11.5, itemType = 'Laptop',
): Promise<ReceivedUnit> {
  const itemTypes: string[] = await worker.call('GET', '/api/v1/inventory/lookups/item-types');
  expect(itemTypes).toContain(itemType);

  const receivable: any[] = await worker.call('GET', '/api/v1/inventory/job-collection/receivable');
  const job = receivable.find((j) => j.jobId === jobId);
  expect(job, 'completed job is waiting at the warehouse').toBeTruthy();
  expect(job.collectorId).toBe(collectorId);
  expect(job.items.length).toBeGreaterThan(0);

  const warehouseLocationId = await firstWarehouseLocation(worker);
  const receipt = await worker.call('POST', '/api/v1/inventory/job-collection/receive-delivery', {
    collectorId,
    warehouseLocationId,
    notes: 'E2E delivery',
    jobs: [{
      jobId,
      items: job.items.map((item: any) => ({
        submissionItemId: item.submissionItemId,
        receivedQuantity: item.quantity,
        itemType,
        verifiedWeightKg: verifiedWeightKg / job.items.length,
      })),
    }],
  }, 201);

  const line = receipt.jobs[0];
  expect(line.jobId).toBe(jobId);
  expect(Number(line.verifiedWeightKg)).toBeCloseTo(verifiedWeightKg, 3);
  expect(Number(line.paymentAmount), 'collector payment calculated').toBeGreaterThan(0);
  expect(line.items[0].inventoryItemId, 'inventory unit created').toBeTruthy();

  // Received jobs drop off the receivable list (no double receiving).
  const after: any[] = await worker.call('GET', '/api/v1/inventory/job-collection/receivable');
  expect(after.map((j) => j.jobId)).not.toContain(jobId);

  const unit = await worker.call('GET', `/api/v1/inventory/${line.items[0].inventoryItemId}`);
  expect(unit.status).toBe('Received');
  expect(unit.jobId).toBe(jobId);

  return { inventoryItemId: line.items[0].inventoryItemId, warehouseLocationId, paymentAmount: Number(line.paymentAmount) };
}

/** Sorting -> dismantle: the unit yields a material that goes straight to Sales. */
export async function dismantleToMaterial(
  worker: Actor, inventoryItemId: string, materialType: string, weightKg = 2.5,
): Promise<RecoveredMaterial> {
  const sorted = await worker.call('PUT', `/api/v1/inventory/${inventoryItemId}/status`, {
    nextStatus: InventoryStatus.Sorting,
    notes: 'E2E: sorting',
  });
  expect(sorted.status).toBe('Sorting');

  const log = await worker.call('POST', `/api/v1/inventory/${inventoryItemId}/dismantle-log`, {
    description: 'E2E: stripped copper wiring',
    childItems: [],
    materials: [{ materialType, weightKg, hazardous: false }],
  });
  expect(log.materialInventoryItemIds).toHaveLength(1);
  // Weight is conserved: 11.5 kg unit -> 2.5 kg copper + 9 kg left on the unit.
  expect(Number(log.updatedWeightKg)).toBeCloseTo(11.5 - weightKg, 3);

  const parent = await worker.call('GET', `/api/v1/inventory/${inventoryItemId}`);
  expect(parent.status).toBe('Dismantling');

  const materialItemId = log.materialInventoryItemIds[0];
  const material = await worker.call('GET', `/api/v1/inventory/${materialItemId}`);
  expect(material.status).toBe('ReadyForSale');
  expect(material.kind).toBe('Material');
  expect(material.itemType).toBe(materialType);
  expect(material.parentInventoryItemId).toBe(inventoryItemId);
  expect(Number(material.verifiedWeightKg)).toBeCloseTo(weightKg, 3);

  return { materialItemId, materialType, weightKg };
}
