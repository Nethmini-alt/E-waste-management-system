import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, Search, Truck } from 'lucide-react';
import { collectionApi, errorMessage } from './collectionApi';
import type { Job, JobStatus } from './types';
import {
  JobStatusPill,
  attentionReason,
  formatDateTime,
  formatRoute,
  needsAttention,
  timeAgo,
} from './jobStatus';

// Collectors accept, reject and complete jobs from the Flutter app, so this
// page refreshes itself to show those changes without a manual reload.
const POLL_MS = 30_000;

type FilterKey = 'all' | 'attention' | 'waiting' | 'accepted' | 'inProgress' | 'collected' | 'cancelled';

const FILTERS: { key: FilterKey; label: string; match: (s: JobStatus) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'attention', label: 'Needs attention', match: needsAttention },
  { key: 'waiting', label: 'Waiting for collector', match: (s) => s === 'Assigned' },
  { key: 'accepted', label: 'Accepted', match: (s) => s === 'Accepted' },
  { key: 'inProgress', label: 'In progress', match: (s) => s === 'InProgress' },
  { key: 'collected', label: 'Collected', match: (s) => s === 'Completed' },
  { key: 'cancelled', label: 'Cancelled', match: (s) => s === 'Cancelled' },
];

const jobPath = (id: string) => `/collection/jobs/${id}`;

const JobsDashboardPage: React.FC = () => {
  const navigate = useNavigate();

  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLoadedAt, setLastLoadedAt] = useState<number | null>(null);

  // ?q= pre-fills the search, e.g. the collectors page links to one collector's jobs.
  const [searchParams] = useSearchParams();
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState(searchParams.get('q') ?? '');

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      setJobs(await collectionApi.listJobs());
      setError(null);
      setLastLoadedAt(Date.now());
    } catch (e) {
      // A failed background poll shouldn't wipe a table that's already on screen.
      if (mode !== 'silent') setError(errorMessage(e, "Couldn't load collection jobs. Check that the API is running, then try again."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load('initial');
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') load('silent');
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const attentionJobs = useMemo(
    () =>
      jobs
        .filter((j) => needsAttention(j.status))
        // Oldest first: the job that's been stuck longest is the most urgent.
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [jobs],
  );

  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>;
    for (const f of FILTERS) c[f.key] = jobs.filter((j) => f.match(j.status)).length;
    return c;
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter)!;
    const q = search.trim().toLowerCase();
    return jobs.filter(
      (j) =>
        active.match(j.status) &&
        (!q ||
          j.pickupAddress.toLowerCase().includes(q) ||
          (j.collectorName ?? '').toLowerCase().includes(q)),
    );
  }, [jobs, filter, search]);

  const clearFilters = () => {
    setFilter('all');
    setSearch('');
  };

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Collection jobs</h1>
          <p className="mt-1 text-sm text-ink-600">
            Pickups created from approved submissions, from assignment to collection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastLoadedAt && (
            <span className="text-xs text-ink-600" title={formatDateTime(new Date(lastLoadedAt).toISOString())}>
              Updated {timeAgo(new Date(lastLoadedAt).toISOString())}
            </span>
          )}
          <button
            type="button"
            onClick={() => load('refresh')}
            disabled={refreshing || loading}
            className="btn-glass-light flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => load('refresh')} className="font-semibold underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      {/* Needs attention — the one loud element on the page */}
      {!loading && !error && (
        attentionJobs.length > 0 ? (
          <section
            aria-labelledby="attention-heading"
            className="mb-6 rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-lg shadow-amber-500/10 backdrop-blur"
          >
            <h2 id="attention-heading" className="flex items-center gap-2 font-display text-base font-bold text-amber-950">
              <AlertTriangle size={18} className="text-amber-600" aria-hidden />
              {attentionJobs.length === 1 ? '1 job needs your attention' : `${attentionJobs.length} jobs need your attention`}
            </h2>
            <ul className="mt-3 divide-y divide-amber-200/80">
              {attentionJobs.map((j) => (
                <li key={j.jobId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink-900">{j.pickupAddress}</span>
                      <JobStatusPill status={j.status} />
                    </div>
                    <p className="mt-1 text-sm text-amber-900/90">{attentionReason(j.status)}</p>
                  </div>
                  <span className="text-xs text-amber-900/70" title={formatDateTime(j.createdAt)}>
                    Created {timeAgo(j.createdAt)}
                  </span>
                  <Link
                    to={jobPath(j.jobId)}
                    className="btn-glass rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                  >
                    {j.status === 'PickupLocationUnresolved' ? 'Fix address' : 'Assign collector'}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : (
          jobs.length > 0 && (
            <p className="mb-6 flex items-center gap-2 text-sm text-mint-800">
              <CheckCircle2 size={16} aria-hidden /> Nothing needs your attention right now.
            </p>
          )
        )
      )}

      {/* Status filters double as the summary counts */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter jobs by status">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${
                  active
                    ? 'bg-mint-600 text-white shadow-md shadow-mint-500/30'
                    : 'bg-white/70 text-ink-800 hover:bg-white'
                }`}
              >
                {f.label}
                <span
                  className={`min-w-[1.5rem] rounded-full px-1.5 text-center text-xs tabular-nums ${
                    active ? 'bg-white/25' : f.key === 'attention' && counts.attention > 0 ? 'bg-amber-200 text-amber-950' : 'bg-ink-100'
                  }`}
                >
                  {loading ? '–' : counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <label className="relative ml-auto w-full sm:w-72">
          <span className="sr-only">Search by address or collector</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search address or collector"
            className="w-full rounded-xl border border-mint-100 bg-white/80 py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-600/70 focus:border-mint-400 focus:outline-none focus:ring-2 focus:ring-mint-200"
          />
        </label>
      </div>

      {/* Jobs table (hidden if the very first load failed; the error above explains why) */}
      {!(error && jobs.length === 0) && (
      <div className="glass overflow-hidden rounded-2xl">
        {loading ? (
          <p className="px-5 py-10 text-center text-sm text-ink-600">Loading jobs…</p>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center px-5 py-14 text-center">
            <Truck size={36} className="text-mint-400" aria-hidden />
            <p className="mt-3 font-semibold text-ink-900">No collection jobs yet</p>
            <p className="mt-1 max-w-sm text-sm text-ink-600">
              A job is created automatically when a submission is approved, and it will show up here.
            </p>
          </div>
        ) : visibleJobs.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-ink-600">
            No jobs match this filter.{' '}
            <button type="button" onClick={clearFilters} className="font-semibold text-mint-700 underline underline-offset-2">
              Show all jobs
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100 text-xs font-semibold text-ink-600">
                  <th scope="col" className="px-5 py-3">Pickup address</th>
                  <th scope="col" className="px-4 py-3">Collector</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Distance and ETA</th>
                  <th scope="col" className="px-4 py-3">Created</th>
                  <th scope="col" className="w-10 px-4 py-3"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((j) => (
                  <tr
                    key={j.jobId}
                    onClick={() => navigate(jobPath(j.jobId))}
                    className={`cursor-pointer border-b border-mint-50 last:border-0 transition-colors hover:bg-mint-50/70 ${
                      needsAttention(j.status) ? 'bg-amber-50/50' : ''
                    }`}
                  >
                    <td className="max-w-xs px-5 py-3">
                      {/* The link makes each row reachable by keyboard; the row click is a mouse shortcut. */}
                      <Link
                        to={jobPath(j.jobId)}
                        onClick={(e) => e.stopPropagation()}
                        className="block truncate font-medium text-ink-900 hover:text-mint-700 focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-mint-500"
                        title={j.pickupAddress}
                      >
                        {j.pickupAddress}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {j.collectorName ?? <span className="text-ink-600/70">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3">
                      <JobStatusPill status={j.status} />
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-800">
                      {formatRoute(j.estimatedDistanceKm, j.estimatedEtaMinutes) ?? <span className="text-ink-600/70">Not available</span>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-ink-600" title={formatDateTime(j.createdAt)}>
                      {timeAgo(j.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-ink-600">
                      <ChevronRight size={16} aria-hidden />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default JobsDashboardPage;
