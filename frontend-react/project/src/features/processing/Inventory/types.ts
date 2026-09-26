import type {
  ClassificationCategory,
  ClassificationSource,
  InventoryStatus,
  OriginType,
} from '../processingEnums';
import type { PagedResponse } from '../types';

// ---- GET /api/v1/inventory ------------------------------------------------

export type InventorySortField = 'CreatedAt' | 'ItemType' | 'WeightKg' | 'Status';

export const INVENTORY_SORT_FIELDS: readonly InventorySortField[] = ['CreatedAt', 'ItemType', 'WeightKg', 'Status'];

export const INVENTORY_SORT_LABELS: Record<InventorySortField, string> = {
  CreatedAt: 'Date received',
  ItemType: 'Item type',
  WeightKg: 'Weight',
  Status: 'Status',
};

export interface InventoryListQuery {
  search?: string;
  status?: InventoryStatus;
  category?: ClassificationCategory;
  originType?: OriginType;
  locationId?: string;
  parentId?: string;
  sortBy?: InventorySortField;
  descending?: boolean;
  page?: number;
  pageSize?: number;
}

export interface InventoryListItem {
  id: string;
  itemType: string;
  status: InventoryStatus;
  originType: OriginType;
  verifiedWeightKg: number;
  currentLocationId: string;
  currentLocationName: string;
  parentInventoryItemId: string | null;
  category: ClassificationCategory | null;
  receivedAt: string;
}

export type InventoryListResponse = PagedResponse<InventoryListItem>;

// ---- GET /api/v1/inventory/{id} -------------------------------------------

export interface InventoryClassification {
  category: ClassificationCategory;
  subCategory: string | null;
  source: ClassificationSource;
  confidenceScore: number | null;
  isFinal: boolean;
  classifiedByStaffId: string | null;
  classifiedAt: string;
}

export interface InventoryChild {
  id: string;
  itemType: string;
  status: InventoryStatus;
  verifiedWeightKg: number;
}

export interface InventoryDetail {
  id: string;
  itemType: string;
  status: InventoryStatus;
  originType: OriginType;
  verifiedWeightKg: number;
  currentLocationId: string;
  currentLocationName: string;
  jobId: string | null;
  submissionId: string | null;
  extraWasteReceiptId: string | null;
  parentInventoryItemId: string | null;
  receivedAt: string;
  classification: InventoryClassification | null;
  children: InventoryChild[];
}

// ---- GET /{id}/history ------------------------------------------------------

export interface ProcessingLogEntry {
  action: string;
  performedByStaffId: string;
  performedAt: string;
  notes: string | null;
}

// ---- actions ---------------------------------------------------------------

export interface TransitionStatusInput {
  nextStatus: InventoryStatus;
  notes?: string;
  newLocationId?: string;
}

export interface InventoryStatusResponse {
  id: string;
  status: InventoryStatus;
  currentLocationId: string;
}

export interface DismantleChildInput {
  itemType: string;
  weightKg: number;
}

export interface DismantleLogInput {
  description: string;
  remainingWeightKg?: number;
  childItems: DismantleChildInput[];
}

export interface DismantleLogResponse {
  inventoryItemId: string;
  updatedWeightKg: number | null;
  childInventoryItemIds: string[];
}

export interface ValidateClassificationInput {
  proposedCategory: ClassificationCategory;
  proposedSubCategory?: string;
  confidenceScore?: number;
}

export interface ValidateClassificationResponse {
  approved: boolean;
  requiresHumanReview: boolean;
  reasons: string[];
}

export interface ClassifyInput {
  category: ClassificationCategory;
  subCategory?: string;
  source: ClassificationSource;
  confidenceScore?: number;
  isFinal: boolean;
}

export interface ClassificationResponse {
  inventoryItemId: string;
  category: ClassificationCategory;
  /** "OnHold" when the backend auto-quarantined a Hazardous item. */
  status: InventoryStatus;
  isFinal: boolean;
}
