export interface AiAnalysis {
  id?: string;
  submissionId?: string;
  wasteCategory?: string;
  estimatedVolumeKg?: number;
  estimatedValueUsd?: number;
  hazardLevel?: string;
  requiresHumanApproval?: boolean;
  analyzedAt?: string;
}

export interface SubmissionItem {
  id?: string;
  submissionId?: string;
  itemName?: string;
  description?: string;
  imageUrl?: string;
}

// One answered question from the mandatory pre-submit AI assessment modal
// (see AIAssessmentModal.tsx). Matches the backend's AssessmentAnswerDto.
export interface AssessmentAnswer {
  question: string;
  answer: string;
}

export interface SubmissionResponse {
  id: string;
  userId?: string;
  userType?: string;
  status: string;
  category?: string;
  estimatedWeight?: number;
  pickupAddress?: string;
  phoneNumber?: string;
  createdAt?: string;
  items?: SubmissionItem[];
  assessmentAnswers?: AssessmentAnswer[];
  aiAnalysis?: AiAnalysis;
  aIAnalysis?: AiAnalysis;
  AiAnalysis?: AiAnalysis;
}