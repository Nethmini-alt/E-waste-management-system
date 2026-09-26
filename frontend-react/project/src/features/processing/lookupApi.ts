import { api } from '../../api/client';
import type { CollectorLookup, RatePolicy, WarehouseLocation } from './types';

// Reference data for dropdowns. Endpoints live in ProcessingLookupsController.
export const lookupApi = {
  warehouseLocations: () =>
    api.get<WarehouseLocation[]>('/api/v1/inventory/lookups/warehouse-locations').then((r) => r.data),

  ratePolicies: (activeOnly = true) =>
    api.get<RatePolicy[]>('/api/v1/inventory/lookups/rate-policies', { params: { activeOnly } }).then((r) => r.data),

  /** Types a job item or dismantled component may be given (active rate-policy types + priced materials). */
  itemTypes: () => api.get<string[]>('/api/v1/inventory/lookups/item-types').then((r) => r.data),

  collectors: () => api.get<CollectorLookup[]>('/api/v1/inventory/lookups/collectors').then((r) => r.data),
};
