import { api } from '../../../api/client';
import type { Buyer, CreateBuyerRequest, UpdateBuyerRequest,AvailableUser } from './types';

export const buyerApi = {
  list: () => api.get<Buyer[]>('/api/buyers').then((r) => r.data),

  get: (id: string) => api.get<Buyer>(`/api/buyers/${id}`).then((r) => r.data),

  create: (body: CreateBuyerRequest) =>
    api.post<Buyer>('/api/buyers', body).then((r) => r.data),

  update: (id: string, body: UpdateBuyerRequest) =>
    api.put<Buyer>(`/api/buyers/${id}`, body).then((r) => r.data),

  remove: (id: string) => api.delete(`/api/buyers/${id}`),

  availableUsers: () => api.get<AvailableUser[]>('/api/buyers/available-users').then(r => r.data),

};