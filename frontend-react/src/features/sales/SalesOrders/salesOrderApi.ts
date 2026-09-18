import { api } from '../../../api/client';
import type {
    SalesOrder,
    CreateSalesOrderRequest,
    UpdateSalesOrderStatusRequest,
} from './types';

export const salesOrderApi = {
  list: (params?: { buyerId?: string; status?: string }) =>
    api.get<SalesOrder[]>('/api/sales-orders', { params }).then((r) => r.data),
  get: (id: string) => api.get<SalesOrder>(`/api/sales-orders/${id}`).then((r) => r.data),
  create: (body: CreateSalesOrderRequest) =>
    api.post<SalesOrder>('/api/sales-orders', body).then((r) => r.data),
  updateStatus: (id: string, body: UpdateSalesOrderStatusRequest) =>
    api.put<SalesOrder>(`/api/sales-orders/${id}/status`, body).then((r) => r.data),
  remove: (id: string) => api.delete(`/api/sales-orders/${id}`),
};