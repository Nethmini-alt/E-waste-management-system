// Component D — Sales, Pricing & Export (owner: Upeksha)
// The recovered material appears as sellable stock; staff sell part of it to
// an active buyer, and completing the order records revenue.

import { expect } from '@playwright/test';
import { anonymous, expectStatus, runId, type Actor } from '../support/api';

export interface CompletedSale {
  salesOrderId: string;
  buyerId: string;
  totalAmount: number;
}

/** Ensures there is exactly one Approved, live price for the material (admin only). */
export async function ensureApprovedPrice(admin: Actor, materialType: string, pricePerKg: number): Promise<number> {
  const approved: any[] = await admin.call('GET', `/api/material-pricing?materialType=${materialType}&status=Approved`);
  const live = approved.find((p) => p.isLive);
  if (live) return Number(live.pricePerKg);

  const today = new Date().toISOString().slice(0, 10);
  const draft = await admin.call('POST', '/api/material-pricing', { materialType, pricePerKg, effectiveDate: today }, 201);
  const updated = await admin.call('PUT', `/api/material-pricing/${draft.pricingId}`, {
    materialType, pricePerKg, effectiveDate: today, expiryDate: null, status: 'Approved',
  });
  expect(updated.status).toBe('Approved');
  return pricePerKg;
}

export async function livePrice(staff: Actor, materialType: string): Promise<number> {
  const approved: any[] = await staff.call('GET', `/api/material-pricing?materialType=${materialType}&status=Approved`);
  const live = approved.find((p) => p.isLive);
  expect(live, `a live approved ${materialType} price`).toBeTruthy();
  return Number(live.pricePerKg);
}

export async function availableQuantity(staff: Actor, materialItemId: string): Promise<number | undefined> {
  const available: any[] = await staff.call('GET', '/api/recovered-materials/available');
  const row = available.find((m) => m.recoveredMaterialId === materialItemId);
  return row === undefined ? undefined : Number(row.quantityKg);
}

/** Public buyer registration, then staff activate the buyer so it can order. */
export async function createActiveBuyer(staff: Actor): Promise<string> {
  const id = runId();
  const anon = await anonymous();
  const res = await anon.post('/api/buyers/register', {
    data: {
      fullName: 'E2E Buyer', email: `e2e.buyer.${id}@ewaste.test`, password: 'Passw0rd!e2e',
      phoneNumber: '0772222222', companyName: `E2E Metals ${id}`, contactPerson: 'E2E Buyer',
      address: 'Colombo 10', buyerType: 'Local',
    },
  });
  await expectStatus(res, 201, 'buyer register');
  const buyer = await res.json();
  await anon.dispose();
  expect(buyer.status).toBe('Pending');

  const active = await staff.call('PUT', `/api/buyers/${buyer.buyerId}`, {
    companyName: buyer.companyName, contactPerson: buyer.contactPerson, email: buyer.email,
    phoneNumber: buyer.phoneNumber, address: buyer.address, buyerType: 'Local', status: 'Active',
  });
  expect(active.status).toBe('Active');
  return buyer.buyerId;
}

/** Sell part of the recovered material, confirm and complete the order, check revenue. */
export async function sellMaterial(staff: Actor, materialItemId: string, materialType: string, quantityKg: number): Promise<CompletedSale> {
  const stockBefore = await availableQuantity(staff, materialItemId);
  expect(stockBefore, 'material is listed as sellable stock').toBeDefined();
  expect(stockBefore!).toBeGreaterThanOrEqual(quantityKg);

  const price = await livePrice(staff, materialType);
  const buyerId = await createActiveBuyer(staff);

  const order = await staff.call('POST', '/api/sales-orders', {
    buyerId, notes: 'E2E order', items: [{ recoveredMaterialId: materialItemId, quantityKg }],
  }, 201);
  expect(order.status).toBe('Draft');
  expect(order.items[0].materialType).toBe(materialType);
  expect(Number(order.totalAmount)).toBeCloseTo(quantityKg * price, 2);

  // The ordered kilos are reserved: they cannot be sold twice.
  expect(await availableQuantity(staff, materialItemId)).toBeCloseTo(stockBefore! - quantityKg, 3);

  expect((await staff.call('PUT', `/api/sales-orders/${order.salesOrderId}/status`, { status: 'Confirmed' })).status).toBe('Confirmed');
  expect((await staff.call('PUT', `/api/sales-orders/${order.salesOrderId}/status`, { status: 'Completed' })).status).toBe('Completed');

  const revenue: any[] = await staff.call('GET', '/api/revenue?transactionType=LocalSale');
  const row = revenue.find((r) => r.referenceId === order.salesOrderId);
  expect(row, 'revenue recorded for the completed order').toBeTruthy();
  expect(Number(row.amount)).toBeCloseTo(Number(order.totalAmount), 2);

  return { salesOrderId: order.salesOrderId, buyerId, totalAmount: Number(order.totalAmount) };
}
