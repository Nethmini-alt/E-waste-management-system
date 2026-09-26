import type { PagedResponse } from '../types';

// GET /api/v1/inventory/job-collection/receivable
// Completed jobs with an assigned collector that have NOT been received yet — filtered on the server.
export interface ReceivableJob {
  jobId: string;
  collectorId: string;
  collectorName: string | null;
  collectorVehicleType: string | null;
  pickupAddress: string;
  reportedWeightKg: number | null;
  estimatedDistanceKm: number | null;
  completedAt: string | null;
  /** The category the customer chose, as they wrote it. */
  submissionCategory: string | null;
  /** That category matched to the item-type list; null when staff must choose the type. */
  suggestedItemType: string | null;
}

// POST /api/v1/inventory/job-collection/receive
// The collector must be the one assigned to the job; the server rejects any other (409).
export interface ReceiveJobWasteInput {
  jobId: string;
  collectorId: string;
  warehouseLocationId: string;
  verifiedWeightKg: number;
  /** From the item-type list. The server falls back to the submission category when omitted. */
  itemType: string;
}

export interface ReceiveJobWasteResponse {
  inventoryItemId: string;
  jobId: string;
  itemType: string;
  verifiedWeightKg: number;
  reportedWeightKg: number | null;
  discrepancyKg: number | null;
  receivedAt: string;
}

// POST /api/v1/inventory/extra-waste/receive
export interface ReceiveExtraWasteItemInput {
  itemType: string;
  weightKg: number;
  accepted: boolean;
  rejectionReason?: string;
}

export interface ReceiveExtraWasteInput {
  collectorId: string;
  warehouseLocationId: string;
  notes?: string;
  idempotencyKey?: string;
  items: ReceiveExtraWasteItemInput[];
}

export interface ExtraWasteReceiptItemResult {
  itemType: string;
  accepted: boolean;
  rejectionReason: string | null;
  inventoryItemId: string | null;
}

export interface ReceiveExtraWasteResponse {
  extraWasteReceiptId: string;
  receivedAt: string;
  items: ExtraWasteReceiptItemResult[];
}

// GET /api/v1/inventory/extra-waste  (receipt history)
export interface ReceiptListQuery {
  collectorId?: string;
  page?: number;
  pageSize?: number;
}

export interface ReceiptListItem {
  receiptId: string;
  receivedAt: string;
  collectorId: string;
  collectorName: string | null;
  itemCount: number;
  acceptedCount: number;
  rejectedCount: number;
  totalWeightKg: number;
  acceptedWeightKg: number;
  /** Null when every line was rejected (no payment is raised). */
  paymentId: string | null;
  paymentStatus: 'Pending' | 'Paid' | null;
  paymentAmount: number | null;
}

export type ReceiptListResponse = PagedResponse<ReceiptListItem>;

// GET /api/v1/inventory/extra-waste/{id}
export interface ReceiptLine {
  id: string;
  itemType: string;
  weightKg: number;
  accepted: boolean;
  rejectionReason: string | null;
  inventoryItemId: string | null;
  /** True only for accepted lines of a receipt that produced a payment. */
  contributesToPayment: boolean;
  /** From the payment's saved snapshot; null when none was saved (older receipts). */
  ratePerKg: number | null;
  /** What the line contributed: its saved amount, or 0 for a rejected line; null when unknown. */
  lineAmount: number | null;
}

export interface ReceiptPaymentSummary {
  paymentId: string;
  status: 'Pending' | 'Paid';
  amount: number;
  hasSnapshot: boolean;
}

export interface ReceiptDetail {
  receiptId: string;
  receivedAt: string;
  notes: string | null;
  collectorId: string;
  collectorName: string | null;
  collectorVehicleType: string | null;
  receivedByStaffId: string;
  receivedByName: string | null;
  acceptedCount: number;
  rejectedCount: number;
  totalWeightKg: number;
  acceptedWeightKg: number;
  /** Null when nothing was accepted, so no payment exists. */
  payment: ReceiptPaymentSummary | null;
  items: ReceiptLine[];
}
