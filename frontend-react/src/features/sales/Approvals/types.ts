export interface ApprovalAction {
  approvalActionId: string;
  actionType: 'Submitted' | 'RevisionRequested' | 'Approved' | 'Rejected';
  performedByUserId: string;
  performedByName: string;
  comments?: string | null;
  performedAt: string;
}

export interface CommercialPlan {
  commercialPlanId: string;
  workflowId: string;
  recommendedRoute: 'LocalSale' | 'Export';
  selectedBuyerId?: string | null;
  selectedBuyerName?: string | null;
  destinationCountry?: string | null;
  materialsJson: string;
  expectedRevenue: number;
  estimatedCosts: number;
  estimatedNetValue: number;
  reasoningSummary: string;
  approvalRequired: boolean;
  riskFlags?: string | null;
  status: 'Draft' | 'PendingApproval' | 'Approved' | 'Rejected' | 'RevisionRequested' | 'Executed';
  createdAt: string;
  updatedAt?: string | null;
  approvalActions: ApprovalAction[];
}

export interface PlanMaterial {
  materialType: string;
  quantityKg: number;
  qualityGrade?: string;
  recoveredMaterialId?: string;
}

export interface ApprovalDecisionRequest {
  decision: 'Approved' | 'Rejected' | 'RevisionRequested';
  comments?: string;
}