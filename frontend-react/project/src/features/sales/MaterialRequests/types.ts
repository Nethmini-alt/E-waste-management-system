export interface MaterialRequest {
  materialRequestId: string;
  buyerId: string;
  buyerCompanyName: string;
  materialType: string;
  quantityKg: number;
  status: 'Waiting' | 'WaitingForPrice' | 'GeneratingPlan' | 'PlanGenerated' | 'PlanGenerationFailed' | 'OrderPlaced' | 'Fulfilled' | 'Cancelled';
  commercialPlanId?: string | null;
  salesOrderId?: string | null;
  lastMatchingNote?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateMaterialRequest {
  materialType: string;
  quantityKg: number;
}