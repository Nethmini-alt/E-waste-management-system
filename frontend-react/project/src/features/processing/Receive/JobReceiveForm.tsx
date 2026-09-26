import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, MapPin, RefreshCw, Search, Truck, Wallet } from 'lucide-react';
import { receiveApi } from './receiveApi';
import type { ReceivableJob, ReceiveJobWasteResponse } from './types';
import { useItemTypes, useWarehouseLocations } from '../hooks/useLookups';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, formatKg, formatSignedKg, shortId } from '../utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Notice,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
} from '../components';

const collectorLabel = (job: ReceivableJob): string =>
  job.collectorName ? `${job.collectorName}${job.collectorVehicleType ? ` · ${job.collectorVehicleType}` : ''}` : `Collector ${shortId(job.collectorId)}`;

const JobReceiveForm: React.FC = () => {
  const locations = useWarehouseLocations();
  const itemTypes = useItemTypes();

  // The server only returns completed jobs that have a collector and are not yet received, so a refresh
  // never brings a received job back. There is no client-side "already received" bookkeeping.
  const [jobs, setJobs] = useState<ReceivableJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<ReceivableJob | null>(null);
  const [weight, setWeight] = useState('');
  const [itemType, setItemType] = useState('');
  const [locationId, setLocationId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiveJobWasteResponse | null>(null);

  const loadJobs = useCallback(async () => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      setJobs(await receiveApi.listReceivableJobs());
    } catch (e) {
      setJobsError(getApiErrorMessage(e, 'Failed to load the jobs waiting to be received.'));
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // Default the destination to the receiving bay once locations arrive.
  useEffect(() => {
    if (!locationId && locations.data.length > 0) {
      const receiving = locations.data.find((l) => /receiv/i.test(l.name)) ?? locations.data[0];
      setLocationId(receiving.id);
    }
  }, [locations.data, locationId]);

  const visibleJobs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.pickupAddress.toLowerCase().includes(q) ||
        j.jobId.toLowerCase().includes(q) ||
        collectorLabel(j).toLowerCase().includes(q),
    );
  }, [jobs, search]);

  const selectJob = (job: ReceivableJob) => {
    setSelected(job);
    setWeight(job.reportedWeightKg !== null ? String(job.reportedWeightKg) : '');
    // Pre-select the customer's category when it is on the list; otherwise staff must choose.
    setItemType(job.suggestedItemType ?? '');
    setSubmitted(false);
    setError(null);
  };

  const weightNum = Number(weight);
  const problems: string[] = [];
  if (selected) {
    if (!itemType) problems.push('Choose what the collected waste is (item type).');
    if (!(weightNum > 0)) problems.push('Enter the verified weight (greater than 0).');
    if (!locationId) problems.push('Choose the warehouse location.');
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setSubmitted(true);
    if (problems.length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      // The job's own collector is sent; the server verifies it and rejects anything else.
      const res = await receiveApi.receiveJob({
        jobId: selected.jobId,
        collectorId: selected.collectorId,
        warehouseLocationId: locationId,
        verifiedWeightKg: weightNum,
        itemType,
      });
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to receive the job.'));
      // If someone else got there first (or the job changed), the server's list is the truth.
      loadJobs();
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setSelected(null);
    setWeight('');
    setItemType('');
    setSubmitted(false);
    setError(null);
    loadJobs();
  };

  // ---------------------------------------------------------------- success view
  if (result) {
    const diff = result.discrepancyKg;
    const matches = diff !== null && Math.abs(diff) < 0.005;
    return (
      <GlassCard>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-mint-700">
            <CheckCircle2 size={22} />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">Job received into inventory</h3>
            <p className="text-sm text-ink-600">
              A new <span className="font-semibold text-ink-900">{result.itemType}</span> inventory item was created and a pending payment was raised for the job's collector.
            </p>
          </div>
        </div>

        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/60 p-4">
            <dt className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Verified weight</dt>
            <dd className="mt-1 font-display text-xl font-bold text-ink-900">{formatKg(result.verifiedWeightKg)}</dd>
          </div>
          <div className="rounded-2xl bg-white/60 p-4">
            <dt className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Reported by collector</dt>
            <dd className="mt-1 font-display text-xl font-bold text-ink-900">
              {result.reportedWeightKg !== null ? formatKg(result.reportedWeightKg) : '—'}
            </dd>
          </div>
          <div className={`rounded-2xl p-4 ${diff === null ? 'bg-white/60' : matches ? 'bg-mint-50' : 'bg-amber-50'}`}>
            <dt className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Discrepancy</dt>
            <dd className="mt-1 font-display text-xl font-bold text-ink-900">
              {diff === null ? 'Not available' : matches ? 'None' : formatSignedKg(diff)}
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-wrap gap-2">
          <Link to={`/processing/inventory/${result.inventoryItemId}`} className={btnPrimary}>
            Open inventory item
          </Link>
          <Link to="/processing/payments" className={btnSecondary}>
            <Wallet size={14} /> View pending payments
          </Link>
          <button type="button" onClick={reset} className={btnSecondary}>
            Receive another job
          </button>
        </div>
      </GlassCard>
    );
  }

  // ---------------------------------------------------------------- form view
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      {/* Job picker */}
      <GlassCard className="lg:col-span-3" padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">1 · Choose a completed job</h3>
            <p className="text-xs text-ink-600">Completed jobs with an assigned collector that have not been received yet.</p>
          </div>
          <button type="button" onClick={loadJobs} className={btnSecondary} disabled={jobsLoading}>
            <RefreshCw size={14} className={jobsLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        <div className="px-5 pt-3">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search address, collector or job id…"
              aria-label="Search jobs"
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>

        <div className="max-h-[28rem] overflow-y-auto p-5 pt-3">
          {jobsError ? (
            <ErrorMessage message={jobsError} onRetry={loadJobs} />
          ) : jobsLoading && jobs.length === 0 ? (
            <LoadingState label="Loading jobs…" />
          ) : visibleJobs.length === 0 ? (
            <EmptyState
              icon={Truck}
              title={jobs.length === 0 ? 'No jobs waiting to be received' : 'No jobs match your search'}
              description={
                jobs.length === 0
                  ? 'When a collector completes a pickup it appears here until it has been received into inventory.'
                  : 'Try a different address, collector or job id.'
              }
            />
          ) : (
            <ul className="space-y-2">
              {visibleJobs.map((job) => {
                const active = selected?.jobId === job.jobId;
                return (
                  <li key={job.jobId}>
                    <button
                      type="button"
                      onClick={() => selectJob(job)}
                      aria-pressed={active}
                      className={[
                        'w-full rounded-2xl border p-3.5 text-left transition',
                        active ? 'border-mint-400 bg-mint-50 ring-2 ring-mint-200' : 'border-mint-100 bg-white/60 hover:bg-mint-50/60',
                      ].join(' ')}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="flex items-start gap-1.5 text-sm font-semibold text-ink-900">
                          <MapPin size={14} className="mt-0.5 flex-shrink-0 text-mint-600" /> {job.pickupAddress || 'No address recorded'}
                        </span>
                        <span className="whitespace-nowrap font-mono text-xs text-ink-600">{shortId(job.jobId)}</span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
                        <span>{collectorLabel(job)}</span>
                        {job.submissionCategory && <span>Category: {job.submissionCategory}</span>}
                        <span>Reported {job.reportedWeightKg !== null ? formatKg(job.reportedWeightKg) : 'n/a'}</span>
                        {job.estimatedDistanceKm !== null && <span>{job.estimatedDistanceKm} km</span>}
                        <span>Completed {formatDateTime(job.completedAt)}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </GlassCard>

      {/* Receive form */}
      <GlassCard className="lg:col-span-2">
        <h3 className="font-display text-base font-bold text-ink-900">2 · Verify and receive</h3>
        {!selected ? (
          <p className="mt-2 text-sm text-ink-600">Select a job on the left to weigh it in.</p>
        ) : (
          <form onSubmit={submit} className="mt-3 space-y-4" noValidate>
            <div className="rounded-2xl bg-white/60 p-3 text-xs text-ink-800">
              <p className="font-semibold text-ink-900">{selected.pickupAddress}</p>
              <p className="mt-0.5 text-ink-600">Collector: {collectorLabel(selected)}</p>
              <p className="mt-0.5 text-[11px] text-ink-600">The payment always goes to the job's own collector.</p>
            </div>

            <div>
              <label className={labelClass} htmlFor="jr-type">
                Item type
              </label>
              <select id="jr-type" value={itemType} onChange={(e) => setItemType(e.target.value)} className={inputClass} disabled={itemTypes.loading}>
                <option value="">{itemTypes.loading ? 'Loading…' : 'Choose what was collected…'}</option>
                {itemTypes.data.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              {selected.submissionCategory && !selected.suggestedItemType && (
                <p className="mt-1 text-xs text-amber-700">
                  The customer's category “{selected.submissionCategory}” isn't a known item type — choose the closest match.
                </p>
              )}
              {itemTypes.error && <ErrorMessage className="mt-2" message={itemTypes.error} onRetry={itemTypes.reload} />}
            </div>

            <div>
              <label className={labelClass} htmlFor="jr-weight">
                Verified weight (kg)
              </label>
              <input
                id="jr-weight"
                type="number"
                min="0"
                step="0.01"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className={inputClass}
                placeholder="Weighed at the warehouse"
              />
              {selected.reportedWeightKg !== null && (
                <p className="mt-1 text-xs text-ink-600">Collector reported {formatKg(selected.reportedWeightKg)}. The difference is recorded on the item.</p>
              )}
            </div>

            <div>
              <label className={labelClass} htmlFor="jr-location">
                Warehouse location
              </label>
              <select id="jr-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass} disabled={locations.loading}>
                {locations.loading && <option value="">Loading…</option>}
                {locations.data.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              {locations.error && <ErrorMessage className="mt-2" message={locations.error} onRetry={locations.reload} />}
            </div>

            {submitted && problems.length > 0 && (
              <Notice tone="error">
                <ul className="list-disc pl-4">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </Notice>
            )}
            {error && <ErrorMessage message={error} />}

            <div className="flex gap-2">
              <button type="submit" className={btnPrimary} disabled={submitting}>
                {submitting ? 'Receiving…' : 'Receive into inventory'}
              </button>
              <button type="button" className={btnSecondary} onClick={() => { setSelected(null); setError(null); }} disabled={submitting}>
                Clear
              </button>
            </div>
          </form>
        )}
      </GlassCard>
    </div>
  );
};

export default JobReceiveForm;
