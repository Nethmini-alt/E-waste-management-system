import { api } from '../../../api/client';
import type {
    ExportOrder,
    CreateExportOrderRequest,
    UpdateExportOrderStatusRequest,
} from './types';

export const exportOrderApi = {
  list: (params?: { buyerId?: string; status?: string; destinationCountry?: string }) =>
    api.get<ExportOrder[]>('/api/export-orders', { params }).then((r) => r.data),
  get: (id: string) => api.get<ExportOrder>(`/api/export-orders/${id}`).then((r) => r.data),
  create: (body: CreateExportOrderRequest) =>
    api.post<ExportOrder>('/api/export-orders', body).then((r) => r.data),
  updateStatus: (id: string, body: UpdateExportOrderStatusRequest) =>
    api.put<ExportOrder>(`/api/export-orders/${id}/status`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/export-orders/${id}`),
};