// Mirrors SubmissionResponseDto on the backend. `status` is derived there
// from the job (once one exists) or the workflow — never set directly.
export type SubmissionStatus =
  | 'NotProcessed'
  | 'Analyzing'
  | 'AwaitingReview'
  | 'Scheduling'
  | 'Closed'
  | 'Rejected'
  | 'Failed'
  | 'CollectorAssigned'
  | 'AwaitingCollector'
  | 'Collected'
  | 'Cancelled';

/** Statuses where the background agent chain is still working on its own. */
export const IN_PROGRESS_STATUSES: SubmissionStatus[] = ['Analyzing', 'Scheduling'];

export interface SubmissionAnalysis {
  wasteCategory: string;
  hazardLevel: string;
  estimatedVolumeKg: number;
  estimatedValueUsd: number;
  confidenceScore: number;
}

export interface SubmissionWorkflow {
  workflowId: string;
  status: string;
  approvalRequired: boolean;
  analysis: SubmissionAnalysis | null;
}

export interface SubmissionItem {
  id: string;
  itemName: string;
  description: string | null;
  imageUrl: string;
}

export interface SubmissionResponse {
  id: string;
  userId: string;
  userType: string;
  category: string;
  estimatedWeight: number;
  pickupAddress: string;
  phoneNumber: string;
  createdAt: string;
  items: SubmissionItem[];
  status: SubmissionStatus;
  statusLabel: string;
  statusReason: string | null;
  workflow: SubmissionWorkflow | null;
  jobId: string | null;
  jobStatus: string | null;
}

export interface CreateSubmissionPayload {
  category: string;
  estimatedWeight: number;
  pickupAddress: string;
  phoneNumber: string;
  items: { itemName: string; description: string; imageUrl: string }[];
}
