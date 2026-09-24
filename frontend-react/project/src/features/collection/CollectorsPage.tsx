import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, MapPinOff, RefreshCw, Search, Star, Users } from 'lucide-react';
import { collectionApi, errorMessage } from './collectionApi';
import type { Collector } from './types';
import { formatDateTime, timeAgo } from './jobStatus';

const POLL_MS = 30_000;

// The Flutter app sends a position periodically while a collector is on
// shift. If an online collector hasn't reported for this long, matching is
// working from an old position.
const STALE_AFTER_MIN = 15;

type LocationState = 'fresh' | 'stale' | 'never';

const locationState = (c: Collector, now: number): LocationState => {
  if (!c.locationUpdatedAt || c.currentLatitude == null || c.currentLongitude == null) return 'never';
  const mins = (now - new Date(c.locationUpdatedAt).getTime()) / 60_000;
  return mins > STALE_AFTER_MIN ? 'stale' : 'fresh';
};

const isFull = (c: Collector) => c.activeJobCount >= c.maxActiveJobs;

// "Needs checking" only matters for online collectors: an offline collector
// with an old location is expected, and matching skips them anyway.
const needsLocationCheck = (c: Collector, now: number) => c.isAvailable && locationState(c, now) !== 'fresh';

type FilterKey = 'all' | 'online' | 'offline' | 'full' | 'location';

const FILTERS: { key: FilterKey; label: string; match: (c: Collector, now: number) => boolean }[] = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'online', label: 'Online', match: (c) => c.isAvailable },
  { key: 'offline', label: 'Offline', match: (c) => !c.isAvailable },
  { key: 'full', label: 'At job limit', match: isFull },
  { key: 'location', label: 'Location out of date', match: needsLocationCheck },
];

// ---------------------------------------------------------------------------

const Workload: React.FC<{ c: Collector }> = ({ c }) => {
  const full = isFull(c);
  return (
    <div className="flex items-center gap-2" aria-label={`${c.activeJobCount} of ${c.maxActiveJobs} active jobs`}>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: c.maxActiveJobs }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-5 rounded-full ${
              i < c.activeJobCount ? (full ? 'bg-amber-500' : 'bg-mint-600') : 'bg-ink-100'
            }`}
          />
        ))}
      </div>
      <span className={`text-sm tabular-nums ${full ? 'font-semibold text-amber-800' : 'text-ink-800'}`}>
        {c.activeJobCount}/{c.maxActiveJobs}
      </span>
    </div>
  );
};

const LastLocation: React.FC<{ c: Collector; now: number }> = ({ c, now }) => {
  const state = locationState(c, now);
  if (state === 'never')
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm ${c.isAvailable ? 'font-medium text-amber-800' : 'text-ink-600/70'}`}>
        <MapPinOff size={14} aria-hidden /> Never shared
      </span>
    );

  const warn = state === 'stale' && c.isAvailable;
  return (
    <div className="flex flex-wrap items-center gap-x-2">
      <span
        className={`text-sm ${warn ? 'font-medium text-amber-800' : 'text-ink-800'}`}
        title={formatDateTime(c.locationUpdatedAt!)}
      >
        {timeAgo(c.locationUpdatedAt!, now)}
      </span>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${c.currentLatitude},${c.currentLongitude}`}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-flex items-center gap-0.5 rounded text-xs font-semibold text-mint-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500"
        aria-label={`Show ${c.fullName}'s last location on a map`}
      >
        Map <ExternalLink size={11} aria-hidden />
      </a>
    </div>
  );
};

// ---------------------------------------------------------------------------

const CollectorsPage: React.FC = () => {
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent') => {
    if (mode === 'initial') setLoading(true);
    if (mode === 'refresh') setRefreshing(true);
    try {
      setCollectors(await collectionApi.listCollectors());
      setError(null);
    } catch (e) {
      if (mode !== 'silent') setError(errorMessage(e, "Couldn't load collectors. Check that the API is running, then try again."));
    } finally {
      // Location ages are relative to this moment.
      setNow(Date.now());
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

  const counts = useMemo(() => {
    const c = {} as Record<FilterKey, number>;
    for (const f of FILTERS) c[f.key] = collectors.filter((x) => f.match(x, now)).length;
    return c;
  }, [collectors, now]);

  const visible = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter)!;
    const q = search.trim().toLowerCase();
    return collectors.filter(
      (c) =>
        active.match(c, now) &&
        (!q ||
          c.fullName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.vehicleType.toLowerCase().includes(q)),
    );
  }, [collectors, filter, search, now]);

  const onlineCount = counts.online ?? 0;
  const matchableCount = collectors.filter(
    (c) => c.isAvailable && !isFull(c) && locationState(c, now) !== 'never',
  ).length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900">Collectors</h1>
          <p className="mt-1 text-sm text-ink-600">
            {loading
              ? 'Who is on shift, how busy they are, and where they were last seen.'
              : `${onlineCount} of ${collectors.length} online. ${matchableCount} can take a new job right now.`}
          </p>
        </div>
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

      {error && (
        <div role="alert" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span>{error}</span>
          <button type="button" onClick={() => load('refresh')} className="font-semibold underline underline-offset-2">
            Try again
          </button>
        </div>
      )}

      {!loading && counts.location > 0 && (
        <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-900 backdrop-blur">
          {counts.location === 1
            ? '1 online collector hasn’t sent a location'
            : `${counts.location} online collectors haven’t sent a location`}{' '}
          in the last {STALE_AFTER_MIN} minutes. Matching uses their last known position, which may be wrong. Ask them
          to open the collector app.
        </p>
      )}

      {/* Filters and search */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter collectors">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const warn = f.key === 'location' && counts.location > 0;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 ${
                  active ? 'bg-mint-600 text-white shadow-md shadow-mint-500/30' : 'bg-white/70 text-ink-800 hover:bg-white'
                }`}
              >
                {f.label}
                <span
                  className={`min-w-[1.5rem] rounded-full px-1.5 text-center text-xs tabular-nums ${
                    active ? 'bg-white/25' : warn ? 'bg-amber-200 text-amber-950' : 'bg-ink-100'
                  }`}
                >
                  {loading ? '–' : counts[f.key]}
                </span>
              </button>
            );
          })}
        </div>

        <label className="relative ml-auto w-full sm:w-72">
          <span className="sr-only">Search by name, email or vehicle</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-600" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email or vehicle"
            className="w-full rounded-xl border border-mint-100 bg-white/80 py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-600/70 focus:border-mint-400 focus:outline-none focus:ring-2 focus:ring-mint-200"
          />
        </label>
      </div>

      {/* Table */}
      {!(error && collectors.length === 0) && (
        <div className="glass overflow-hidden rounded-2xl">
          {loading ? (
            <p className="px-5 py-10 text-center text-sm text-ink-600">Loading collectors…</p>
          ) : collectors.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-14 text-center">
              <Users size={36} className="text-mint-400" aria-hidden />
              <p className="mt-3 font-semibold text-ink-900">No collectors yet</p>
              <p className="mt-1 max-w-sm text-sm text-ink-600">
                Collectors register with the Collector role, then set up their vehicle and capacity in the collector app.
              </p>
            </div>
          ) : visible.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-ink-600">
              No collectors match this filter.{' '}
              <button
                type="button"
                onClick={() => { setFilter('all'); setSearch(''); }}
                className="font-semibold text-mint-700 underline underline-offset-2"
              >
                Show all collectors
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-mint-100 text-xs font-semibold text-ink-600">
                    <th scope="col" className="px-5 py-3">Collector</th>
                    <th scope="col" className="px-4 py-3">Status</th>
                    <th scope="col" className="px-4 py-3">Vehicle</th>
                    <th scope="col" className="px-4 py-3">Active jobs</th>
                    <th scope="col" className="px-4 py-3">Rating</th>
                    <th scope="col" className="px-4 py-3">Last location</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr
                      key={c.collectorId}
                      className={`border-b border-mint-50 last:border-0 ${needsLocationCheck(c, now) ? 'bg-amber-50/50' : ''}`}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium text-ink-900">{c.fullName || 'Unnamed collector'}</p>
                        <p className="text-xs text-ink-600">
                          {c.email}
                          {c.phone && (
                            <>
                              {', '}
                              <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a>
                            </>
                          )}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                            c.isAvailable ? 'bg-mint-100 text-mint-800' : 'bg-ink-100 text-ink-600'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${c.isAvailable ? 'bg-mint-600' : 'bg-ink-600/50'}`} aria-hidden />
                          {c.isAvailable ? 'Online' : 'Offline'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-ink-900">{c.vehicleType}</p>
                        <p className="text-xs tabular-nums text-ink-600">Up to {c.capacityKg} kg</p>
                      </td>
                      <td className="px-4 py-3">
                        {c.activeJobCount > 0 ? (
                          <Link
                            to={`/collection/jobs?q=${encodeURIComponent(c.fullName)}`}
                            className="inline-block rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500"
                            title={`Show ${c.fullName}'s jobs`}
                          >
                            <Workload c={c} />
                          </Link>
                        ) : (
                          <Workload c={c} />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 tabular-nums text-ink-800">
                          <Star size={13} className="text-amber-500" aria-hidden /> {c.rating.toFixed(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <LastLocation c={c} now={now} />
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

export default CollectorsPage;
