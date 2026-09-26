import { api } from '../../../api/client';
import type { CreateMaterialRequest, MaterialRequest } from './types';

export const materialRequestApi = {
  create: (body: CreateMaterialRequest) =>
    api.post<MaterialRequest>('/api/material-requests', body).then((response) => response.data),
  listMine: () =>
    api.get<MaterialRequest[]>('/api/material-requests/mine').then((response) => response.data),
  listAll: () =>
    api.get<MaterialRequest[]>('/api/material-requests').then((response) => response.data),
  cancel: (id: string) => api.post(`/api/material-requests/${id}/cancel`),
};