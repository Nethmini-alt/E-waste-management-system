import { api } from '../../../api/client';
import type { Buyer } from '../Buyers/types';
import type { MaterialPricing } from '../Pricing/types';
import type { RecoveredMaterial } from '../Materials/types';

export const dashboardApi = {
  buyers: () => api.get<Buyer[]>('/api/buyers').then((r) => r.data),
  pricing: () => api.get<MaterialPricing[]>('/api/material-pricing').then((r) => r.data),
  availableMaterials: () =>
    api.get<RecoveredMaterial[]>('/api/recovered-materials/available').then((r) => r.data),
};