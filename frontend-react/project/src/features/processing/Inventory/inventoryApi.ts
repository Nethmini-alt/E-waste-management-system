import { api } from '../../../api/client';
import { classificationCategoryValue, classificationSourceValue, inventoryStatusValue } from '../processingEnums';
import type {
  ClassificationResponse,
  ClassifyInput,
  DismantleLogInput,
  DismantleLogResponse,
  InventoryDetail,
  InventoryListQuery,
  InventoryListResponse,
  InventoryStatusResponse,
  ProcessingLogEntry,
  TransitionStatusInput,
  ValidateClassificationInput,
  ValidateClassificationResponse,
} from './types';

const BASE = '/api/v1/inventory';

// Query-string enums are sent by name (model binding accepts names). Request-BODY enums must be
// numbers because the backend has no JsonStringEnumConverter — the conversion happens here, once.
export const inventoryApi = {
  list: (q: InventoryListQuery) =>
    api
      .get<InventoryListResponse>(BASE, {
        params: { ...q, search: q.search?.trim() || undefined },
      })
      .then((r) => r.data),

  get: (id: string) => api.get<InventoryDetail>(`${BASE}/${id}`).then((r) => r.data),

  history: (id: string) => api.get<ProcessingLogEntry[]>(`${BASE}/${id}/history`).then((r) => r.data),

  transition: (id: string, input: TransitionStatusInput) =>
    api
      .put<InventoryStatusResponse>(`${BASE}/${id}/status`, {
        nextStatus: inventoryStatusValue(input.nextStatus),
        notes: input.notes?.trim() || null,
        newLocationId: input.newLocationId || null,
      })
      .then((r) => r.data),

  addDismantleLog: (id: string, input: DismantleLogInput) =>
    api
      .post<DismantleLogResponse>(`${BASE}/${id}/dismantle-log`, {
        description: input.description.trim(),
        remainingWeightKg: input.remainingWeightKg ?? null,
        childItems: input.childItems.map((c) => ({ itemType: c.itemType.trim(), weightKg: c.weightKg })),
      })
      .then((r) => r.data),

  /** Dry-run check. No side effects — must be called before classify. */
  validateClassification: (id: string, input: ValidateClassificationInput) =>
    api
      .post<ValidateClassificationResponse>(`${BASE}/${id}/validate-classification`, {
        proposedCategory: classificationCategoryValue(input.proposedCategory),
        proposedSubCategory: input.proposedSubCategory?.trim() || null,
        confidenceScore: input.confidenceScore ?? null,
      })
      .then((r) => r.data),

  classify: (id: string, input: ClassifyInput) =>
    api
      .put<ClassificationResponse>(`${BASE}/${id}/classify`, {
        category: classificationCategoryValue(input.category),
        subCategory: input.subCategory?.trim() || null,
        source: classificationSourceValue(input.source),
        confidenceScore: input.confidenceScore ?? null,
        isFinal: input.isFinal,
      })
      .then((r) => r.data),

  moveLocation: (id: string, newLocationId: string) =>
    api.put<void>(`${BASE}/${id}/location`, { newLocationId }).then(() => undefined),
};
