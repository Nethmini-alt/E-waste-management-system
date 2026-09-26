export interface MaterialRequest {
  materialRequestId: string;
  buyerId: string;
  buyerCompanyName: string;
  materialType: string;
  quantityKg: number;
  status: 'Waiting' | 'GeneratingPlan' | 'PlanGenerated' | 'PlanGenerationFailed' | 'OrderPlaced' | 'Fulfilled' | 'Cancelled';
  commercialPlanId?: string | null;
  salesOrderId?: string | null;
  createdAt: string;
  updatedAt?: string | null;
}

export interface CreateMaterialRequest {
  materialType: string;
  quantityKg: number;
}