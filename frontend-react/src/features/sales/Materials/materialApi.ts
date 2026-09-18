import { api } from '../../../api/client';
import type { RecoveredMaterial } from './types';

export const materialApi = {
  listAll: () => api.get<RecoveredMaterial[]>('/api/recovered-materials').then((r) => r.data),
  listAvailable: () =>
    api.get<RecoveredMaterial[]>('/api/recovered-materials/available').then((r) => r.data),
  get: (id: string) =>
    api.get<RecoveredMaterial>(`/api/recovered-materials/${id}`).then((r) => r.data),
};