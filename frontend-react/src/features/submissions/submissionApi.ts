import axios from 'axios';
import type { SubmissionResponse } from './types';

const API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5172';

export const submissionApi = {
  /** Create a new submission (used by SubmitPage) */
  create: (payload: {
    userId: string;
    userType: string;
    items: { itemName: string; description: string; imageUrl: string }[];
  }) =>
    axios
      .post<SubmissionResponse>(`${API}/api/v1/submissions`, payload)
      .then((r) => r.data),

  /** Get one submission by id (used by SubmitPage polling) */
  getById: (id: string) =>
    axios
      .get<SubmissionResponse>(`${API}/api/v1/submissions/${id}`)
      .then((r) => r.data),

  /** List all submissions (used by AdminReviewPage) */
  list: async (): Promise<SubmissionResponse[]> => {
    const res = await axios.get(`${API}/api/v1/submissions`);
    const data = res.data;

    // Backend may return: array, { data: [...] }, { items: [...] }
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  },

  /** Update submission status (admin approve/reject) */
  updateStatus: (id: string, status: 'Approved' | 'Rejected') =>
    axios
      .patch(`${API}/api/v1/submissions/${id}/status`, { status })
      .then((r) => r.data),
};