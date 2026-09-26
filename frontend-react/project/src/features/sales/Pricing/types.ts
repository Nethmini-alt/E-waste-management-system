export interface MaterialPricing {
  pricingId: string;
  materialType: string;
  pricePerKg: number;
  effectiveDate: string;      // "YYYY-MM-DD"
  expiryDate?: string | null;
  status: 'Draft' | 'Approved' | 'Expired';
  /** Approved AND still inside its expiry window — the only status that may price an order. */
  isLive: boolean;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateMaterialPricingRequest {
  materialType: string;
  pricePerKg: number;
  effectiveDate: string;
  expiryDate?: string | null;
}

export interface UpdateMaterialPricingRequest {
  materialType: string;
  pricePerKg: number;
  effectiveDate: string;
  expiryDate?: string | null;
  status: 'Draft' | 'Approved' | 'Expired';
}

export interface MaterialPricingFilter {
  materialType?: string;
  status?: string;
}