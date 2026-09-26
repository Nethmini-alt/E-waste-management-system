import { api } from '../../../api/client';
import type { ApprovalEntry, ExecutionStep, WorkflowSummary } from './types';

/**
 * Uses the EXISTING workflow API — nothing here starts, changes or re-runs an agent.
 *   - list / get / execution-log: Staff or Admin
 *   - approve / reject:           Admin only (enforced by the server)
 *   - approvals:                  read-only history, added for this screen
 */
export const agenticReviewApi = {
  /** Optionally narrowed by workflow status (bound by name on the server, e.g. "PendingApproval"). */
  list: (status?: string) =>
    api.get<WorkflowSummary[]>('/api/workflows', { params: status ? { status } : undefined }).then((r) => r.data),

  executionLog: (id: string) => api.get<ExecutionStep[]>(`/api/workflows/${id}/execution-log`).then((r) => r.data),

  approvals: (id: string) => api.get<ApprovalEntry[]>(`/api/workflows/${id}/approvals`).then((r) => r.data),

  approve: (id: string, comments: string) =>
    api.post<{ message: string }>(`/api/workflows/${id}/approve`, { comments: comments.trim() || null }).then((r) => r.data),

  reject: (id: string, comments: string) =>
    api.post<{ message: string }>(`/api/workflows/${id}/reject`, { comments: comments.trim() || null }).then((r) => r.data),
};
