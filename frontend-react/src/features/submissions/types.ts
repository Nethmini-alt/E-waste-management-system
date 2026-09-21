export interface AiAnalysis {
  id?: string;
  submissionId?: string;
  wasteCategory: string;
  estimatedVolumeKg: number;
  estimatedValueLkr: number;
  hazardLevel: string;
  requiresHumanApproval: boolean;
  analyzedAt?: string;
}

export interface CreateSubmissionPayload {
  userId: string;
  userType: string;
  pickupAddress?: string;
  items: SubmissionItem[];
}

export interface SubmissionItem {
  id?: string;
  submissionId?: string;
  itemName: string;
  description: string;
  imageUrl: string;
}

export interface SubmissionResponse {
  id: string;
  userId?: string;
  userType?: string;
  status: string;
  createdAt?: string;
  items?: SubmissionItem[];
  aiAnalysis?: AiAnalysis;
  pickupAddress?: string;
}