import { api } from '../../api/client';
import type { CreateSubmissionPayload, SubmissionResponse } from './types';

// Uses the shared client so the JWT is attached — every submissions
// endpoint requires a logged-in user. Approve/reject is not here: it goes
// through the workflow endpoints (see processing/AgenticReview).
export const submissionApi = {
  /** Create a new submission (Household/Corporate). Owner comes from the token. */
  create: (payload: CreateSubmissionPayload) =>
    api.post<SubmissionResponse>('/api/v1/submissions', payload).then((r) => r.data),

  /** Get one submission by id (owner or staff/admin). */
  getById: (id: string) =>
    api.get<SubmissionResponse>(`/api/v1/submissions/${id}`).then((r) => r.data),

  /** The logged-in user's own submissions. */
  mine: () =>
    api.get<SubmissionResponse[]>('/api/v1/submissions/mine').then((r) => r.data),

  /** Every submission (staff/admin). */
  list: () =>
    api.get<SubmissionResponse[]>('/api/v1/submissions').then((r) => r.data),
};
