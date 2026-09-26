export interface RecoveredMaterial {
  recoveredMaterialId: string;
  materialType: string;
  quantityKg: number;
  qualityGrade: string;
  processingStatus: string;
  safetyValidated: boolean;
  workflowId?: string | null;
  availableAt: string;
}