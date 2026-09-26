import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Sparkles, Star, UserCheck } from 'lucide-react';
import { collectionApi, errorMessage } from './collectionApi';
import type { CollectorMatch, Job, JobHistoryEntry } from './types';
import { formatRoute } from './jobStatus';

interface Props {
  job: Job;
  history: JobHistoryEntry[];
  onDone: (updated: Job, message: string) => void;
}

// Shows the same ranked list the matcher works from (available collectors,
// under the load cap, nearest first) so staff can see why matching chose
// who it did, and pick someone themselves when it couldn't.
const CandidatePicker: React.FC<Props> = ({ job, history, onDone }) => {
  const [candidates, setCandidates] = useState<CollectorMatch[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null); // collectorId, or 'auto'

  const declined = new Set(history.filter((h) => h.outcome === 'Rejected').map((h) => h.collectorId));

  const load = useCallback(async () => {
    if (job.pickupLatitude == null || job.pickupLongitude == null) return;
    setLoadError(null);
    setCandidates(null);
    try {
      const list = await collectionApi.findCandidates(job.pickupLatitude, job.pickupLongitude, 8);
      // The current assignee isn't a "new" option.
      setCandidates(list.filter((c) => c.collectorId !== job.collectorId));
    } catch (e) {
      setLoadError(errorMessage(e, "Couldn't load available collectors."));
    }
  }, [job.pickupLatitude, job.pickupLongitude, job.collectorId]);

  useEffect(() => {
    load();
  }, [load]);

  const assign = async (c: CollectorMatch) => {
    setBusy(c.collectorId);
    setActionError(null);
    try {
      onDone(await collectionApi.reassignJob(job.jobId, c.collectorId), `Assigned to ${c.collectorName}.`);
    } catch (e) {
      setActionError(errorMessage(e, `Couldn't assign ${c.collectorName}.`));
    } finally {
      setBusy(null);
    }
  };

  const autoMatch = async () => {
    setBusy('auto');
    setActionError(null);
    try {
      const updated = await collectionApi.reassignJob(job.jobId);
      onDone(
        updated,
        updated.collectorName ? `Matching assigned ${updated.collectorName}.` : 'Matching ran again, but no collector is available yet.',
      );
    } catch (e) {
      setActionError(errorMessage(e, "Couldn't run matching."));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-600">Available collectors near the pickup, nearest first.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="btn-glass-light flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500"
          >
            <RefreshCw size={12} /> Refresh list
          </button>
          <button
            type="button"
            onClick={autoMatch}
            disabled={busy !== null}
            className="btn-glass flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <Sparkles size={12} /> {busy === 'auto' ? 'Matching…' : 'Let matching choose'}
          </button>
        </div>
      </div>

      {actionError && (
        <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{actionError}</p>
      )}

      <div className="mt-3">
        {loadError ? (
          <p className="text-sm text-rose-800">{loadError}</p>
        ) : candidates === null ? (
          <p className="text-sm text-ink-600">Looking for available collectors…</p>
        ) : candidates.length === 0 ? (
          <p className="rounded-xl bg-white/60 px-4 py-3 text-sm text-ink-600">
            No collectors are online with room for another job. Try again when someone comes online, or check the
            collectors list.
          </p>
        ) : (
          <ul className="divide-y divide-mint-100 overflow-hidden rounded-xl bg-white/60">
            {candidates.map((c, i) => (
              <li key={c.collectorId} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                <span className="w-5 text-sm font-semibold tabular-nums text-ink-600" aria-label={`Rank ${i + 1}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-ink-900">
                    {c.collectorName || 'Unnamed collector'}
                    {job.requiredCapacityKg != null && c.capacityKg < job.requiredCapacityKg && (
                      <span
                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900"
                        title={`Estimated load is about ${job.requiredCapacityKg} kg`}
                      >
                        Vehicle too small
                      </span>
                    )}
                    {declined.has(c.collectorId) && (
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
                        Declined this job
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-ink-600">
                    {c.vehicleType}, up to {c.capacityKg} kg. {c.activeJobCount} active{' '}
                    {c.activeJobCount === 1 ? 'job' : 'jobs'}.
                  </p>
                </div>
                <span className="text-sm tabular-nums text-ink-800">
                  {formatRoute(c.distanceKm, c.etaMinutes) ?? 'Route unavailable'}
                </span>
                <span className="flex items-center gap-1 text-sm tabular-nums text-ink-800" title="Rating">
                  <Star size={13} className="text-amber-500" aria-hidden /> {c.rating.toFixed(1)}
                </span>
                <button
                  type="button"
                  onClick={() => assign(c)}
                  disabled={busy !== null}
                  className="btn-glass-light flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 disabled:opacity-60"
                >
                  <UserCheck size={13} /> {busy === c.collectorId ? 'Assigning…' : 'Assign'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default CandidatePicker;
