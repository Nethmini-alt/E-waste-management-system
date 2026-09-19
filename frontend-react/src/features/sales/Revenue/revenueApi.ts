import { api } from '../../../api/client';
import type { RevenueTransaction, RevenueSummary } from './types';

export const revenueApi = {
  list: (params?: { transactionType?: string; fromDate?: string; toDate?: string }) =>
    api.get<RevenueTransaction[]>('/api/revenue', { params }).then((r) => r.data),
  summary: () => api.get<RevenueSummary>('/api/revenue/summary').then((r) => r.data),
};