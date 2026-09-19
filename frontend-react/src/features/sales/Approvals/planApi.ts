import { api } from '../../../api/client';
import type { CommercialPlan, ApprovalDecisionRequest } from './types';

export const planApi = {
  list: (params?: { status?: string; recommendedRoute?: string }) =>
    api.get<CommercialPlan[]>('/api/commercial-plans', { params }).then((r) => r.data),
  get: (id: string) =>
    api.get<CommercialPlan>(`/api/commercial-plans/${id}`).then((r) => r.data),
  decide: (id: string, body: ApprovalDecisionRequest) =>
    api.post<CommercialPlan>(`/api/commercial-plans/${id}/decide`, body).then((r) => r.data),
  markExecuted: (id: string) =>
    api.post<CommercialPlan>(`/api/commercial-plans/${id}/mark-executed`).then((r) => r.data),
};