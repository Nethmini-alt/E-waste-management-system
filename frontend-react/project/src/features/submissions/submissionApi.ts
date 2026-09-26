import { api } from '../../api/client';
import type { AssessmentAnswer, SubmissionResponse } from './types';

export type CreateSubmissionPayload = {
  userId: string;
  userType: string;
  category: string;
  estimatedWeight: number;
  pickupAddress: string;
  phoneNumber: string;
  assessmentAnswers: AssessmentAnswer[];
  items: { itemName: string; description: string; imageUrl: string }[];
};

export type SubmissionStatus = 'Pending_AI_Analysis' | 'Pending_Approval' | 'Approved' | 'Rejected';

export const submissionApi = {
  create: async (payload: CreateSubmissionPayload): Promise<SubmissionResponse> => {
    const res = await api.post<SubmissionResponse>('/api/v1/submissions', payload);
    return res.data;
  },

  getById: async (id: string): Promise<SubmissionResponse> => {
    const res = await api.get<SubmissionResponse>(`/api/v1/submissions/${id}`);
    return res.data;
  },

  list: async (): Promise<SubmissionResponse[]> => {
    const res = await api.get('/api/v1/submissions');
    const data = res.data;

    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  },

  updateStatus: async (id: string, status: SubmissionStatus) => {
    const res = await api.patch(`/api/v1/submissions/${id}/status`, { status });
    return res.data;
  },
};