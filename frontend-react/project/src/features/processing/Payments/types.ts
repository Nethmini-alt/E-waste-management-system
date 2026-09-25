import type { PaymentSourceType, PaymentStatus } from '../processingEnums';
import type { PagedResponse } from '../types';

// GET /api/v1/payments  (pending AND paid)
export interface PaymentListQuery {
  status?: PaymentStatus;
  collectorId?: string;
  sourceType?: PaymentSourceType;
  page?: number;
  pageSize?: number;
}

export interface PaymentListItem {
  id: string;
  sourceType: PaymentSourceType;
  sourceId: string;
  collectorId: string;
  /** From the collector's user account; null if the collector record can no longer be resolved. */
  collectorName: string | null;
  collectorVehicleType: string | null;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface PaymentListResponse extends PagedResponse<PaymentListItem> {
  /** Both totals follow the collector/source filters but ignore the status filter. */
  totalPendingAmount: number;
  totalPaidAmount: number;
}

// PUT /api/v1/payments/{id}/pay
export interface PaymentResponse {
  id: string;
  sourceType: PaymentSourceType;
  sourceId: string;
  collectorId: string;
  amount: number;
  status: PaymentStatus;
  createdAt: string;
  paidAt: string | null;
}

/** The minimum the "mark as paid" confirmation needs — satisfied by both a list row and a payment detail. */
export interface MarkPaidTarget {
  id: string;
  sourceType: PaymentSourceType;
  collectorId: string;
  collectorName: string | null;
  collectorVehicleType: string | null;
  amount: number;
  createdAt: string;
}

// ---- GET /api/v1/payments/{id}  — the SAVED calculation snapshot, never recalculated ----

export interface JobCalculationSnapshot {
  verifiedWeightKg: number;
  reportedWeightKg: number | null;
  discrepancyKg: number | null;
  /** Rate-policy key the weight part was priced with (always "GeneralCollection"). */
  weightRateItemType: string;
  ratePerKg: number;
  weightAmount: number;
  baseFee: number;
  /** The job's estimated distance, or null when none was known. */
  distanceKm: number | null;
  /** The distance actually used (0 when distanceKm is null). */
  distanceUsedKm: number;
  distanceRatePerKm: number;
  distanceAmount: number;
}

export interface ExtraWasteLineSnapshot {
  receiptItemId: string | null;
  itemType: string;
  weightKg: number;
  accepted: boolean;
  /** Null for rejected lines: no rate is applied to them. */
  ratePerKg: number | null;
  /** Unrounded weight × rate for accepted lines; always 0 for rejected lines. */
  amount: number;
  includedInTotal: boolean;
  rejectionReason: string | null;
}

export interface PaymentCalculationSnapshot {
  schemaVersion: number;
  sourceType: PaymentSourceType;
  totalAmount: number;
  job: JobCalculationSnapshot | null;
  extraWaste: { lines: ExtraWasteLineSnapshot[] } | null;
}

export interface PaymentJobInfo {
  jobId: string;
  completedAt: string | null;
  inventoryItemId: string | null;
}

export interface PaymentReceiptItemInfo {
  id: string;
  itemType: string;
  weightKg: number;
  accepted: boolean;
  rejectionReason: string | null;
  inventoryItemId: string | null;
}

export interface PaymentReceiptInfo {
  receiptId: string;
  receivedAt: string;
  notes: string | null;
  receivedByName: string | null;
  items: PaymentReceiptItemInfo[];
}

export interface PaymentDetail extends MarkPaidTarget {
  sourceId: string;
  status: PaymentStatus;
  paidAt: string | null;
  createdByStaffId: string | null;
  createdByName: string | null;
  paidByStaffId: string | null;
  paidByName: string | null;
  /** False for payments created before snapshots existed — no breakdown is invented for them. */
  hasSnapshot: boolean;
  snapshot: PaymentCalculationSnapshot | null;
  job: PaymentJobInfo | null;
  receipt: PaymentReceiptInfo | null;
}
