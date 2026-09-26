import { api } from '../../../api/client';
import type { RatePolicy } from '../types';

const BASE = '/api/v1/rate-policies';

/**
 * Admin-only rate management (RatePoliciesController). A rate row is never edited: revising or
 * restoring adds a new row and the old one stays as history. Reading rates stays on
 * lookupApi.ratePolicies.
 */
export const ratePolicyApi = {
  create: (itemType: string, ratePerKg: number) =>
    api.post<RatePolicy>(BASE, { itemType: itemType.trim(), ratePerKg }).then((r) => r.data),

  revise: (id: string, ratePerKg: number) => api.put<RatePolicy>(`${BASE}/${id}`, { ratePerKg }).then((r) => r.data),

  deactivate: (id: string) => api.put<RatePolicy>(`${BASE}/${id}/deactivate`).then((r) => r.data),

  restore: (id: string) => api.post<RatePolicy>(`${BASE}/${id}/restore`).then((r) => r.data),
};
