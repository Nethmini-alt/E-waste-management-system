import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, ExternalLink, MapPin, Package, Truck, X } from 'lucide-react';
import { collectionApi, errorMessage } from './collectionApi';
import type { Job, JobHistoryEntry } from './types';
import { JobStatusPill, attentionReason, formatDateTime, formatRoute, timeAgo } from './jobStatus';
import JobTimeline from './JobTimeline';
import CandidatePicker from './CandidatePicker';

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const Section: React.FC<{ title: string; children: React.ReactNode; tone?: 'plain' | 'attention' }> = ({
  title,
  children,
  tone = 'plain',
}) => (
  <section
    className={
      tone === 'attention'
        ? 'rounded-2xl border border-amber-300 bg-amber-50/90 p-5 shadow-lg shadow-amber-500/10 backdrop-blur'
        : 'glass rounded-2xl p-5'
    }
  >
    <h2 className={`mb-3 font-display text-base font-bold ${tone === 'attention' ? 'text-amber-950' : 'text-ink-900'}`}>
      {title}
    </h2>
    {children}
  </section>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <dt className="text-xs font-medium text-ink-600">{label}</dt>
    <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
  </div>
);

// OpenStreetMap's own embeddable map: no API key and no extra npm package,
// and it matches the OSM geocoding/routing the backend already uses.
const PickupMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const d = 0.012;
  const src =
    `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d * 1.5},${lat - d},${lng + d * 1.5},${lat + d}` +
    `&layer=mapnik&marker=${lat},${lng}`;
  return (
    <iframe
      title="Pickup location map"
      src={src}
      loading="lazy"
      className="h-56 w-full rounded-xl border border-mint-100 bg-mint-50"
    />
  );
};

const isAbsoluteUrl = (u: string) => /^https?:\/\//i.test(u);

// The Flutter app decides where photos are stored, so be tolerant: show the
// image when we can, otherwise say plainly what we have.
const PhotoEvidence: React.FC<{ url: string | null }> = ({ url }) => {
  const [failed, setFailed] = useState(false);
  if (url && isAbsoluteUrl(url) && !failed)
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl border border-mint-100">
        <img src={url} alt="Photo taken by the collector at pickup" onError={() => setFailed(true)} className="h-40 w-full object-cover" />
      </a>
    );
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-xl bg-white/60 px-3 text-center text-xs text-ink-600">
      <Package size={22} aria-hidden />
      {!url ? 'No photo attached' : failed ? (
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-mint-700 underline">Photo couldn't be loaded. Open link</a>
      ) : (
        <span className="break-all">Photo: {url}</span>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Fix-address form (for PickupLocationUnresolved / NoCollectorAvailable)
// ---------------------------------------------------------------------------

const AddressForm: React.FC<{ job: Job; onDone: (j: Job, msg: string) => void }> = ({ job, onDone }) => {
  const [address, setAddress] = useState(job.pickupAddress);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await collectionApi.updateJobAddress(job.jobId, address);
      onDone(
        updated,
        updated.collectorName
          ? `Address saved. Assigned to ${updated.collectorName}.`
          : 'Address saved, but no collector is available yet.',
      );
    } catch (err) {
      setError(errorMessage(err, "Couldn't save the address."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label htmlFor="pickup-address" className="text-sm font-medium text-ink-800">
        Pickup address
      </label>
      <div className="mt-1.5 flex flex-wrap gap-2">
        <input
          id="pickup-address"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-mint-200 bg-white px-3 py-2 text-sm text-ink-900 focus:border-mint-400 focus:outline-none focus:ring-2 focus:ring-mint-200"
          aria-describedby="pickup-address-help"
        />
        <button
          type="submit"
          disabled={saving || !address.trim() || address.trim() === job.pickupAddress}
          className="btn-glass rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save and find a collector'}
        </button>
      </div>
      <p id="pickup-address-help" className="mt-1.5 text-xs text-ink-600">
        Include the house number, street and town. A nearby landmark helps in rural areas.
      </p>
      {error && (
        <p role="alert" className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {error}
        </p>
      )}
    </form>
  );
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const JobDetailPage: React.FC = () => {
  const { id = '' } = useParams();

  const [job, setJob] = useState<Job | null>(null);
  const [history, setHistory] = useState<JobHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [flash, setFlash] = useState<string | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [j, h] = await Promise.all([collectionApi.getJob(id), collectionApi.getJobHistory(id)]);
      setJob(j);
      setHistory(h);
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((e as any)?.response?.status === 404) setNotFound(true);
      else setLoadError(errorMessage(e, "Couldn't load this job."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Every staff action returns the updated job; history changes too, so refetch it.
  const handleUpdated = async (updated: Job, message: string) => {
    setJob(updated);
    setFlash(message);
    setShowPicker(false);
    setShowAddress(false);
    try {
      setHistory(await collectionApi.getJobHistory(updated.jobId));
    } catch {
      /* the job itself is already up to date; history will catch up on next load */
    }
  };

  const cancelJob = async () => {
    if (!job) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await handleUpdated(await collectionApi.cancelJob(job.jobId), 'Job cancelled.');
      setConfirmCancel(false);
    } catch (e) {
      setCancelError(errorMessage(e, "Couldn't cancel this job."));
    } finally {
      setCancelling(false);
    }
  };

  const back = (
    <Link
      to="/collection/jobs"
      className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-mint-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500"
    >
      <ArrowLeft size={14} /> Back to jobs
    </Link>
  );

  if (loading) return <div className="mx-auto max-w-6xl">{back}<p className="mt-6 text-sm text-ink-600">Loading job…</p></div>;

  if (notFound || !job)
    return (
      <div className="mx-auto max-w-6xl">
        {back}
        <div className="glass mt-4 rounded-2xl p-6">
          <p className="font-semibold text-ink-900">{notFound ? 'This job doesn’t exist.' : 'Couldn’t load this job.'}</p>
          <p className="mt-1 text-sm text-ink-600">
            {notFound ? 'It may have been removed, or the link is incomplete.' : loadError}
          </p>
          {!notFound && (
            <button type="button" onClick={load} className="mt-3 text-sm font-semibold text-mint-700 underline underline-offset-2">
              Try again
            </button>
          )}
        </div>
      </div>
    );

  const hasCoords = job.pickupLatitude != null && job.pickupLongitude != null;
  const canCancel = job.status !== 'Completed' && job.status !== 'Cancelled';
  const collectorIsOnTheJob = job.status === 'Accepted' || job.status === 'InProgress';
  const route = formatRoute(job.estimatedDistanceKm, job.estimatedEtaMinutes);

  return (
    <div className="mx-auto max-w-6xl">
      {back}

      {/* Header */}
      <div className="mt-3 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-ink-900">{job.pickupAddress}</h1>
          <JobStatusPill status={job.status} />
        </div>
        <p className="mt-1 text-sm text-ink-600">
          Created <span title={formatDateTime(job.createdAt)}>{timeAgo(job.createdAt)}</span>. Job reference{' '}
          <span className="font-mono text-xs">{job.jobId.slice(0, 8)}</span>
        </p>
      </div>

      {flash && (
        <div role="status" className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-mint-200 bg-mint-50/90 px-4 py-3 text-sm text-mint-900">
          <span className="flex items-center gap-2"><CheckCircle2 size={16} aria-hidden /> {flash}</span>
          <button type="button" onClick={() => setFlash(null)} aria-label="Dismiss" className="rounded p-1 hover:bg-mint-100">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ---------------- Main column ---------------- */}
        <div className="flex flex-col gap-5">
          {job.status === 'PickupLocationUnresolved' && (
            <Section title="Correct the pickup address" tone="attention">
              <p className="mb-4 flex gap-2 text-sm text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" aria-hidden />
                {attentionReason(job.status)}
              </p>
              <AddressForm job={job} onDone={handleUpdated} />
            </Section>
          )}

          {job.status === 'NoCollectorAvailable' && (
            <Section title="Assign a collector" tone="attention">
              <p className="mb-4 flex gap-2 text-sm text-amber-900">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-600" aria-hidden />
                {attentionReason(job.status)}
              </p>
              <CandidatePicker job={job} history={history} onDone={handleUpdated} />
              <div className="mt-4 border-t border-amber-200 pt-3">
                {showAddress ? (
                  <AddressForm job={job} onDone={handleUpdated} />
                ) : (
                  <button type="button" onClick={() => setShowAddress(true)} className="text-sm font-semibold text-amber-900 underline underline-offset-2">
                    The address is wrong? Change it
                  </button>
                )}
              </div>
            </Section>
          )}

          {job.collectorName && job.status !== 'NoCollectorAvailable' && (
            <Section title="Collector">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-mint-100 text-mint-700">
                    <Truck size={18} aria-hidden />
                  </div>
                  <div>
                    <p className="font-semibold text-ink-900">{job.collectorName}</p>
                    <p className="text-sm text-ink-600">
                      {job.status === 'Assigned' && 'Offered the job. Waiting for them to accept or decline in the app.'}
                      {job.status === 'Accepted' && `Accepted${job.respondedAt ? ` ${timeAgo(job.respondedAt)}` : ''}. Heading to the pickup.`}
                      {job.status === 'InProgress' && `On the way to the pickup${job.startedAt ? `, set off ${timeAgo(job.startedAt)}` : ''}.`}
                      {job.status === 'Completed' && `Collected${job.completedAt ? ` ${timeAgo(job.completedAt)}` : ''}.`}
                      {job.status === 'Cancelled' && 'Was assigned before the job was cancelled.'}
                    </p>
                  </div>
                </div>
                {job.status === 'Assigned' && !showPicker && (
                  <button
                    type="button"
                    onClick={() => setShowPicker(true)}
                    className="btn-glass-light rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500"
                  >
                    Choose a different collector
                  </button>
                )}
              </div>
              {route && (collectorIsOnTheJob || job.status === 'Assigned') && (
                <p className="mt-3 text-sm text-ink-800">
                  Estimated route from their last known position: <span className="tabular-nums">{route}</span>
                </p>
              )}
              {showPicker && job.status === 'Assigned' && (
                <div className="mt-4 border-t border-mint-100 pt-4">
                  <CandidatePicker job={job} history={history} onDone={handleUpdated} />
                  <button type="button" onClick={() => setShowPicker(false)} className="mt-3 text-sm font-semibold text-ink-600 underline underline-offset-2">
                    Keep {job.collectorName}
                  </button>
                </div>
              )}
            </Section>
          )}

          {job.status === 'Completed' && (
            <Section title="Collection evidence">
              <div className="grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                <PhotoEvidence url={job.photoUrl} />
                <dl className="grid content-start gap-3 sm:grid-cols-2">
                  <Field label="Measured weight">
                    {job.measuredWeightKg != null ? `${job.measuredWeightKg} kg` : 'Not recorded'}
                  </Field>
                  <Field label="Collected at">{job.completedAt ? formatDateTime(job.completedAt) : 'Not recorded'}</Field>
                  <div className="sm:col-span-2">
                    <Field label="Collector's notes">{job.notes || 'No notes'}</Field>
                  </div>
                </dl>
              </div>
              <p className="mt-4 text-xs text-ink-600">Next step: Processing logs this item into inventory when it arrives at the facility.</p>
            </Section>
          )}

          <Section title="History">
            <JobTimeline job={job} history={history} />
          </Section>
        </div>

        {/* ---------------- Side column ---------------- */}
        <div className="flex flex-col gap-5">
          <Section title="Pickup location">
            {hasCoords ? (
              <PickupMap lat={job.pickupLatitude!} lng={job.pickupLongitude!} />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-xl bg-white/60 text-center text-sm text-ink-600">
                <MapPin size={22} aria-hidden />
                Not on the map yet
              </div>
            )}
            <dl className="mt-4 grid gap-3">
              <Field label="Address">{job.pickupAddress}</Field>
              {hasCoords && (
                <Field label="Coordinates">
                  <span className="tabular-nums">
                    {job.pickupLatitude!.toFixed(5)}, {job.pickupLongitude!.toFixed(5)}
                  </span>
                </Field>
              )}
              {job.requiredCapacityKg != null && (
                <Field label="Estimated load">
                  <span className="tabular-nums">About {job.requiredCapacityKg} kg</span>
                  <span className="block text-xs text-ink-600">Only vehicles that can carry this are matched.</span>
                </Field>
              )}
              {(job.scheduledWindowStart || job.scheduledWindowEnd) && (
                <Field label="Pickup window">
                  {job.scheduledWindowStart ? formatDateTime(job.scheduledWindowStart) : 'Any time'} to{' '}
                  {job.scheduledWindowEnd ? formatDateTime(job.scheduledWindowEnd) : 'any time'}
                </Field>
              )}
            </dl>
            {hasCoords && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${job.pickupLatitude},${job.pickupLongitude}`}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-mint-700 hover:underline"
              >
                Open in Google Maps <ExternalLink size={13} aria-hidden />
              </a>
            )}
          </Section>

          {canCancel && (
            <section className="rounded-2xl border border-rose-200 bg-white/60 p-5 backdrop-blur">
              <h2 className="font-display text-base font-bold text-ink-900">Cancel this job</h2>
              {!confirmCancel ? (
                <>
                  <p className="mt-1 text-sm text-ink-600">Use this if the pickup is no longer needed. It can't be undone.</p>
                  <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    className="mt-3 rounded-xl border border-rose-300 px-4 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    Cancel job
                  </button>
                </>
              ) : (
                <>
                  <p className="mt-1 text-sm text-rose-800">
                    {collectorIsOnTheJob
                      ? `${job.collectorName} has already accepted this job and may be on the way. Contact them before cancelling.`
                      : 'The job will stop showing in the collector app and won’t be matched again.'}
                  </p>
                  {cancelError && <p role="alert" className="mt-2 text-sm text-rose-800">{cancelError}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={cancelJob}
                      disabled={cancelling}
                      className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 disabled:opacity-60"
                    >
                      {cancelling ? 'Cancelling…' : 'Yes, cancel job'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setConfirmCancel(false); setCancelError(null); }}
                      className="btn-glass-light rounded-xl px-4 py-2 text-sm font-semibold"
                    >
                      Keep job
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobDetailPage;
