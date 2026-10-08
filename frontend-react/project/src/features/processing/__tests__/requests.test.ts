// TC-C-R07 / R10 / R11 — what the web app actually sends to the API (captured with MSW).
// The backend has no JSON string-enum converter, so enums in request bodies must be numbers,
// and text is trimmed before it is matched against rate policies and material names.
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { server } from '../../../test/server';
import { inventoryApi } from '../Inventory/inventoryApi';
import { receiveApi } from '../Receive/receiveApi';

let captured: { method: string; url: string; body: any }[];

beforeEach(() => {
  captured = [];
  const record = async ({ request }: { request: Request }) => {
    const text = await request.text();
    captured.push({ method: request.method, url: new URL(request.url).pathname + new URL(request.url).search, body: text ? JSON.parse(text) : null });
    return HttpResponse.json({ id: 'x', status: 'ok', childInventoryItemIds: [], materialInventoryItemIds: [], lossKg: 0 });
  };
  server.use(
    http.put('*/api/v1/inventory/:id/status', record),
    http.put('*/api/v1/inventory/:id/classify', record),
    http.post('*/api/v1/inventory/:id/dismantle-log', record),
    http.post('*/api/v1/inventory/extra-waste/receive', record),
    http.post('*/api/v1/inventory/job-collection/receive-delivery', record),
    http.get('*/api/v1/inventory', record),
  );
});

describe('TC-C-R11 status and classification requests', () => {
  it('sends the next status as its backend number, with empty notes as null', async () => {
    await inventoryApi.transition('item-1', { nextStatus: 'Sorting', notes: '   ', newLocationId: '' });
    expect(captured[0]).toEqual({ method: 'PUT', url: '/api/v1/inventory/item-1/status', body: { nextStatus: 1, notes: null, newLocationId: null } });
  });

  it('sends the classification category and source as numbers', async () => {
    await inventoryApi.classify('item-1', { category: 'Hazardous', subCategory: ' Batteries ', source: 'Ai', confidenceScore: 0.9, isFinal: true });
    expect(captured[0].body).toEqual({ category: 2, subCategory: 'Batteries', source: 1, confidenceScore: 0.9, isFinal: true });
  });
});

describe('TC-C-R10 dismantle request', () => {
  it('trims names and sends components and materials separately', async () => {
    await inventoryApi.addDismantleLog('item-1', {
      description: '  Removed battery  ',
      childItems: [{ itemType: ' Battery ', weightKg: 1.2 }],
      materials: [{ materialType: ' Copper ', weightKg: 2.5, hazardous: false }],
    });
    expect(captured[0].body).toEqual({
      description: 'Removed battery',
      remainingWeightKg: null,
      childItems: [{ itemType: 'Battery', weightKg: 1.2 }],
      materials: [{ materialType: 'Copper', weightKg: 2.5, hazardous: false }],
    });
  });
});

describe('TC-C-R07 extra-waste receipt request', () => {
  it('trims item types, and only rejected lines keep a rejection reason', async () => {
    await receiveApi.receiveExtraWaste({
      collectorId: 'col-1',
      warehouseLocationId: 'loc-1',
      notes: '',
      idempotencyKey: 'key-1',
      items: [
        { itemType: '  Laptop ', weightKg: 3, accepted: true, rejectionReason: 'should be dropped' },
        { itemType: 'Battery', weightKg: 1, accepted: false, rejectionReason: '  Leaking  ' },
      ],
    });
    expect(captured[0].body).toEqual({
      collectorId: 'col-1',
      warehouseLocationId: 'loc-1',
      notes: null,
      idempotencyKey: 'key-1',
      items: [
        { itemType: 'Laptop', weightKg: 3, accepted: true, rejectionReason: null },
        { itemType: 'Battery', weightKg: 1, accepted: false, rejectionReason: 'Leaking' },
      ],
    });
  });
});

describe('TC-C-R04 receive-delivery request', () => {
  it('sends one request for the whole delivery, with blank notes as null', async () => {
    await receiveApi.receiveDelivery({
      collectorId: 'col-1',
      warehouseLocationId: 'loc-1',
      notes: '  ',
      jobs: [{ jobId: 'job-1', items: [{ submissionItemId: 'i-1', receivedQuantity: 1, itemType: 'Laptop', verifiedWeightKg: 11.5 }] }],
    } as any);
    expect(captured).toHaveLength(1);
    expect(captured[0].body.notes).toBeNull();
    expect(captured[0].body.jobs[0].items[0]).toEqual({ submissionItemId: 'i-1', receivedQuantity: 1, itemType: 'Laptop', verifiedWeightKg: 11.5 });
  });
});

describe('TC-C-R08 inventory list query', () => {
  it('sends filters by name in the query string and drops a blank search', async () => {
    await inventoryApi.list({ search: '   ', status: 'ReadyForSale', kind: 'Material', page: 2, pageSize: 20 } as any);
    const url = new URL(`http://x${captured[0].url}`);
    expect(url.searchParams.get('status')).toBe('ReadyForSale');
    expect(url.searchParams.get('kind')).toBe('Material');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.has('search')).toBe(false);
  });
});
