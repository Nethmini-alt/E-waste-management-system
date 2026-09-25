import { api } from '../../../api/client';
import type {
    MaterialPricing,
    CreateMaterialPricingRequest,
    UpdateMaterialPricingRequest,
} from './types';

export const pricingApi = {
  list: (params?: { materialType?: string; status?: string }) =>
    api
      .get<MaterialPricing[]>('/api/material-pricing', { params })
      .then((r) => r.data),

  get: (id: string) =>
    api.get<MaterialPricing>(`/api/material-pricing/${id}`).then((r) => r.data),

  create: (body: CreateMaterialPricingRequest) =>
    api.post<MaterialPricing>('/api/material-pricing', body).then((r) => r.data),

  update: (id: string, body: UpdateMaterialPricingRequest) =>
    api.put<MaterialPricing>(`/api/material-pricing/${id}`, body).then((r) => r.data),

  remove: (id: string) => api.delete(`/api/material-pricing/${id}`),

  /**
   * Marks every Approved price whose expiry date has passed as Expired.
   * The server also does this on a background timer; this lets staff force it from the UI.
   */
  expireStale: () =>
    api
      .post<{ expired: number }>('/api/material-pricing/expire-stale')
      .then((r) => r.data),
};