import { api } from '../../api/client';
import type { Collector, CollectorMatch, Job, JobHistoryEntry, JobStatus } from './types';

export const collectionApi = {
  // --- jobs ---
  listJobs: (status?: JobStatus) =>
    api.get<Job[]>('/api/v1/jobs', { params: status ? { status } : {} }).then((r) => r.data),

  getJob: (id: string) => api.get<Job>(`/api/v1/jobs/${id}`).then((r) => r.data),

  getJobHistory: (id: string) =>
    api.get<JobHistoryEntry[]>(`/api/v1/jobs/${id}/history`).then((r) => r.data),

  updateJobAddress: (id: string, pickupAddress: string) =>
    api.put<Job>(`/api/v1/jobs/${id}/address`, { pickupAddress }).then((r) => r.data),

  /** Pass a collectorId to hand-pick; omit it to re-run automatic matching. */
  reassignJob: (id: string, collectorId?: string) =>
    api.put<Job>(`/api/v1/jobs/${id}/reassign`, collectorId ? { collectorId } : {}).then((r) => r.data),

  cancelJob: (id: string) => api.put<Job>(`/api/v1/jobs/${id}/cancel`).then((r) => r.data),

  // --- collectors ---
  listCollectors: (isAvailable?: boolean) =>
    api
      .get<Collector[]>('/api/v1/collectors', {
        params: isAvailable === undefined ? {} : { isAvailable },
      })
      .then((r) => r.data),

  /** Ranked candidates for a pickup point, nearest first. */
  findCandidates: (pickupLatitude: number, pickupLongitude: number, maxResults = 5) =>
    api
      .get<CollectorMatch[]>('/api/v1/collectors/available', {
        params: { pickupLatitude, pickupLongitude, maxResults },
      })
      .then((r) => r.data),
};

/**
 * The Collection endpoints return errors as { message }; ASP.NET's own
 * validation errors come back as ProblemDetails with a `title`. Handle both.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const errorMessage = (e: any, fallback: string): string =>
  e?.response?.data?.message ?? e?.response?.data?.title ?? fallback;
