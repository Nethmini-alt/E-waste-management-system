/** Shapes shared by more than one Processing screen. Feature-specific shapes live beside their API file. */

export interface PagedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

// GET /api/v1/inventory/lookups/*
export interface WarehouseLocation {
  id: string;
  name: string;
  description: string | null;
}

export interface RatePolicy {
  id: string;
  itemType: string;
  ratePerKg: number;
  isActive: boolean;
  effectiveFrom: string;
}

export interface CollectorLookup {
  collectorId: string;
  fullName: string;
  vehicleType: string;
}

/** The signed-in user as stored by AuthContext (a .jsx file, so it has no types of its own). */
export interface CurrentUser {
  userId: string;
  email: string;
  fullName: string;
  role: string;
}
