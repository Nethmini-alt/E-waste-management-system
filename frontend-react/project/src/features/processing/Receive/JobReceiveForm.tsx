import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MapPin, RefreshCw, Truck, Wallet } from 'lucide-react';
import { receiveApi } from './receiveApi';
import type { ReceivableJob, ReceiveDeliveryResponse } from './types';
import { paymentApi } from '../Payments/paymentApi';
import { useItemTypes, useWarehouseLocations } from '../hooks/useLookups';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, formatKg, formatMoney, formatSignedKg, shortId } from '../utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Notice,
  SearchSelect,
  btnPrimary,
  btnSecondary,
  inputClass,
  labelClass,
  tableCellClass,
  tableHeadClass,
} from '../components';

interface JobEntry {
  selected: boolean;
  weight: string;
  itemType: string;
}

const entryFor = (job: ReceivableJob): JobEntry => ({
  selected: false,
  weight: job.reportedWeightKg !== null ? String(job.reportedWeightKg) : '',
  // Pre-select the customer's category when it is on the item-type list; otherwise staff must choose.
  itemType: job.suggestedItemType ?? '',
});

/**
 * A collector often brings several completed jobs in one visit. Choose the collector, tick the jobs
 * they brought and weigh each one. Every job still becomes its own inventory item and its own
 * payment (same formula as before); they are saved together and shown with one pending total.
 */
const JobReceiveForm: React.FC = () => {
  const locations = useWarehouseLocations();
  const itemTypes = useItemTypes();
  const role = useCurrentUser()?.role.toLowerCase();
  const canPay = role === 'admin' || role === 'staff';

  // The server only returns completed jobs that have a collector and are not yet received.
  const [jobs, setJobs] = useState<ReceivableJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [collectorId, setCollectorId] = useState('');
  const [entries, setEntries] = useState<Record<string, JobEntry>>({});
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [result, setResult] = useState<ReceiveDeliveryResponse | null>(null);
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

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

  // Only collectors who actually have jobs waiting can be chosen.
  const collectorOptions = useMemo(() => {
    const byCollector = new Map<string, { name: string; vehicle: string | null; count: number }>();
    jobs.forEach((j) => {
      const existing = byCollector.get(j.collectorId);
      if (existing) existing.count += 1;
      else byCollector.set(j.collectorId, { name: j.collectorName ?? `Collector ${shortId(j.collectorId)}`, vehicle: j.collectorVehicleType, count: 1 });
    });
    return [...byCollector.entries()].map(([id, c]) => ({
      value: id,
      label: c.name,
      hint: `${c.vehicle ? `${c.vehicle} · ` : ''}${c.count} job${c.count === 1 ? '' : 's'} waiting`,
    }));
  }, [jobs]);

  const collectorJobs = useMemo(() => jobs.filter((j) => j.collectorId === collectorId), [jobs, collectorId]);

  const chooseCollector = (id: string) => {
    setCollectorId(id);
    const next: Record<string, JobEntry> = {};
    jobs.filter((j) => j.collectorId === id).forEach((j) => {
      next[j.jobId] = entryFor(j);
    });
    setEntries(next);
    setSubmitted(false);
    setError(null);
  };

  // Opened from a collected job ("Receive into warehouse"): pre-choose its collector and tick it.
  const [params] = useSearchParams();
  const linkedJobId = params.get('jobId');
  const [linkHandled, setLinkHandled] = useState(false);
  const [linkMissing, setLinkMissing] = useState(false);
  useEffect(() => {
    if (!linkedJobId || linkHandled || jobsLoading) return;
    setLinkHandled(true);
    const linked = jobs.find((j) => j.jobId === linkedJobId);
    if (!linked) {
      setLinkMissing(true);
      return;
    }
    const next: Record<string, JobEntry> = {};
    jobs.filter((j) => j.collectorId === linked.collectorId).forEach((j) => {
      next[j.jobId] = { ...entryFor(j), selected: j.jobId === linked.jobId };
    });
    setCollectorId(linked.collectorId);
    setEntries(next);
  }, [linkedJobId, linkHandled, jobsLoading, jobs]);

  const update = (jobId: string, change: Partial<JobEntry>) =>
    setEntries((prev) => ({ ...prev, [jobId]: { ...prev[jobId], ...change } }));

  const selectedJobs = collectorJobs.filter((j) => entries[j.jobId]?.selected);
  const allSelected = collectorJobs.length > 0 && selectedJobs.length === collectorJobs.length;

  const problems: string[] = [];
  if (!collectorId) problems.push('Choose the collector.');
  else if (selectedJobs.length === 0) problems.push('Tick at least one job the collector brought.');
  selectedJobs.forEach((j, i) => {
    const e = entries[j.jobId];
    if (!e.itemType) problems.push(`Job ${i + 1} (${shortId(j.jobId)}): choose the item type.`);
    if (!(Number(e.weight) > 0)) problems.push(`Job ${i + 1} (${shortId(j.jobId)}): enter the verified weight.`);
  });
  if (!locationId) problems.push('Choose the warehouse location.');

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await receiveApi.receiveDelivery({
        collectorId,
        warehouseLocationId: locationId,
        notes,
        jobs: selectedJobs.map((j) => ({
          jobId: j.jobId,
          verifiedWeightKg: Number(entries[j.jobId].weight),
          itemType: entries[j.jobId].itemType,
        })),
      });
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to receive the delivery. Nothing was saved.'));
      loadJobs();
    } finally {
      setSubmitting(false);
    }
  };

  const payNow = async () => {
    if (!result) return;
    setPaying(true);
    setPayError(null);
    try {
      await paymentApi.payDelivery(result.deliveryId);
      setPaid(true);
    } catch (err) {
      setPayError(getApiErrorMessage(err, 'The payment could not be recorded.'));
    } finally {
      setPaying(false);
    }
  };

  const reset = () => {
    setResult(null);
    setPaid(false);
    setPayError(null);
    setCollectorId('');
    setEntries({});
    setNotes('');
    setSubmitted(false);
    setError(null);
    loadJobs();
  };

  // ---------------------------------------------------------------- success view
  if (result) {
    const collectorName = collectorOptions.find((c) => c.value === result.collectorId)?.label ?? 'the collector';
    return (
      <GlassCard>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-mint-700">
            <CheckCircle2 size={22} />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">
              {result.jobs.length} job{result.jobs.length === 1 ? '' : 's'} received from {collectorName}
            </h3>
            <p className="text-sm text-ink-600">Each job became an inventory item and has its own payment. Together they are one delivery.</p>
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[620px] border-collapse">
            <thead>
              <tr className="border-b border-mint-100">
                <th className={`${tableHeadClass} px-4 py-2`}>Job</th>
                <th className={`${tableHeadClass} px-4 py-2`}>Item</th>
                <th className={`${tableHeadClass} px-4 py-2 text-right`}>Verified</th>
                <th className={`${tableHeadClass} px-4 py-2 text-right`}>Difference</th>
                <th className={`${tableHeadClass} px-4 py-2 text-right`}>Payment</th>
              </tr>
            </thead>
            <tbody>
              {result.jobs.map((j) => (
                <tr key={j.jobId} className="border-b border-mint-50">
                  <td className={`${tableCellClass} font-mono text-xs`}>{shortId(j.jobId)}</td>
                  <td className={tableCellClass}>
                    <Link to={`/processing/inventory/${j.inventoryItemId}`} className="font-semibold text-mint-700 hover:underline">
                      {j.itemType}
                    </Link>
                  </td>
                  <td className={`${tableCellClass} text-right font-mono`}>{formatKg(j.verifiedWeightKg)}</td>
                  <td className={`${tableCellClass} text-right font-mono`}>
                    {j.discrepancyKg === null ? '—' : Math.abs(j.discrepancyKg) < 0.005 ? 'None' : formatSignedKg(j.discrepancyKg)}
                  </td>
                  <td className={`${tableCellClass} text-right font-mono`}>{formatMoney(j.paymentAmount)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={4} className={`${tableCellClass} text-right font-semibold text-ink-900`}>
                  {paid ? 'Total paid' : 'Total pending'}
                </td>
                <td className={`${tableCellClass} text-right font-mono text-base font-bold text-ink-900`}>{formatMoney(result.totalPendingAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {paid && (
          <Notice tone="success" className="mt-4">
            All {result.jobs.length} payment{result.jobs.length === 1 ? '' : 's'} of this delivery were marked as paid.
          </Notice>
        )}
        {payError && <ErrorMessage className="mt-4" message={payError} />}

        <div className="mt-6 flex flex-wrap gap-2">
          {canPay && !paid && (
            <button type="button" onClick={payNow} className={btnPrimary} disabled={paying}>
              <Wallet size={14} /> {paying ? 'Paying…' : `Pay ${formatMoney(result.totalPendingAmount)} now`}
            </button>
          )}
          <Link to="/processing/payments" className={btnSecondary}>
            <Wallet size={14} /> View payments
          </Link>
          <button type="button" onClick={reset} className={btnSecondary}>
            Receive another delivery
          </button>
        </div>
      </GlassCard>
    );
  }

  // ---------------------------------------------------------------- form view
  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {linkMissing && (
        <Notice tone="info">That job is not waiting to be received. It may already be in inventory.</Notice>
      )}
      <GlassCard>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">1 · Which collector is delivering?</h3>
            <p className="text-xs text-ink-600">Type the first letters of the name. Only collectors with completed jobs waiting are listed.</p>
          </div>
          <button type="button" onClick={loadJobs} className={btnSecondary} disabled={jobsLoading}>
            <RefreshCw size={14} className={jobsLoading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
        <div className="mt-3 max-w-md">
          <SearchSelect
            id="jr-collector"
            value={collectorId}
            onChange={chooseCollector}
            disabled={jobsLoading}
            placeholder={jobsLoading ? 'Loading…' : 'Type the collector’s name…'}
            emptyText="No collector with that name has jobs waiting"
            options={collectorOptions}
          />
        </div>
        {jobsError && <ErrorMessage className="mt-3" message={jobsError} onRetry={loadJobs} />}
      </GlassCard>

      {collectorId && (
        <GlassCard padded={false}>
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
            <div>
              <h3 className="font-display text-base font-bold text-ink-900">2 · Tick the jobs they brought and weigh each one</h3>
              <p className="text-xs text-ink-600">Each ticked job gets its own inventory item and payment.</p>
            </div>
            {collectorJobs.length > 1 && (
              <label className="flex items-center gap-2 text-sm font-semibold text-ink-800">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => collectorJobs.forEach((j) => update(j.jobId, { selected: e.target.checked }))}
                  className="h-4 w-4 accent-mint-600"
                />
                Select all
              </label>
            )}
          </div>
          <div className="space-y-2 p-5 pt-3">
            {jobsLoading && collectorJobs.length === 0 ? (
              <LoadingState label="Loading jobs…" />
            ) : collectorJobs.length === 0 ? (
              <EmptyState icon={Truck} title="No jobs waiting" description="This collector has no completed jobs left to receive." />
            ) : (
              collectorJobs.map((job) => {
                const e = entries[job.jobId] ?? entryFor(job);
                return (
                  <div
                    key={job.jobId}
                    className={`rounded-2xl border p-3.5 transition ${e.selected ? 'border-mint-400 bg-mint-50/70' : 'border-mint-100 bg-white/60'}`}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={e.selected}
                        onChange={(ev) => update(job.jobId, { selected: ev.target.checked })}
                        className="mt-1 h-4 w-4 accent-mint-600"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className="flex items-start gap-1.5 text-sm font-semibold text-ink-900">
                            <MapPin size={14} className="mt-0.5 flex-shrink-0 text-mint-600" /> {job.pickupAddress || 'No address recorded'}
                          </span>
                          <span className="whitespace-nowrap font-mono text-xs text-ink-600">{shortId(job.jobId)}</span>
                        </span>
                        <span className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-600">
                          {job.submissionCategory && <span>Category: {job.submissionCategory}</span>}
                          <span>Reported {job.reportedWeightKg !== null ? formatKg(job.reportedWeightKg) : 'n/a'}</span>
                          {job.estimatedDistanceKm !== null && <span>{job.estimatedDistanceKm} km</span>}
                          <span>Completed {formatDateTime(job.completedAt)}</span>
                        </span>
                      </span>
                    </label>

                    {e.selected && (
                      <div className="mt-3 grid gap-3 pl-7 sm:grid-cols-2">
                        <div>
                          <label className={labelClass} htmlFor={`jr-type-${job.jobId}`}>
                            Item type
                          </label>
                          <select
                            id={`jr-type-${job.jobId}`}
                            value={e.itemType}
                            onChange={(ev) => update(job.jobId, { itemType: ev.target.value })}
                            className={inputClass}
                            disabled={itemTypes.loading}
                          >
                            <option value="">{itemTypes.loading ? 'Loading…' : 'Choose what was collected…'}</option>
                            {itemTypes.data.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={labelClass} htmlFor={`jr-weight-${job.jobId}`}>
                            Verified weight (kg)
                          </label>
                          <input
                            id={`jr-weight-${job.jobId}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={e.weight}
                            onChange={(ev) => update(job.jobId, { weight: ev.target.value })}
                            className={inputClass}
                            placeholder="Weighed at the warehouse"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {itemTypes.error && <ErrorMessage message={itemTypes.error} onRetry={itemTypes.reload} />}
          </div>
        </GlassCard>
      )}

      {collectorId && (
        <GlassCard>
          <h3 className="font-display text-base font-bold text-ink-900">3 · Where it goes</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
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
            <div>
              <label className={labelClass} htmlFor="jr-notes">
                Notes (optional)
              </label>
              <input id="jr-notes" value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
            </div>
          </div>

          {submitted && problems.length > 0 && (
            <Notice tone="error" className="mt-4">
              <ul className="list-disc pl-4">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Notice>
          )}
          {error && <ErrorMessage className="mt-4" message={error} />}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button type="submit" className={btnPrimary} disabled={submitting}>
              {submitting
                ? 'Receiving…'
                : `Receive ${selectedJobs.length || ''} job${selectedJobs.length === 1 ? '' : 's'}`.replace('  ', ' ')}
            </button>
            <p className="text-xs text-ink-600">All ticked jobs are saved together — if one fails, none are saved.</p>
          </div>
        </GlassCard>
      )}
    </form>
  );
};

export default JobReceiveForm;
