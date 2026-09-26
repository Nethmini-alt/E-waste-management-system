import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Plus, Trash2, Wallet, XCircle } from 'lucide-react';
import { receiveApi } from './receiveApi';
import type { ReceiveExtraWasteResponse } from './types';
import { LIMITS, isReservedExtraWasteType } from '../processingEnums';
import { useCollectors, useRatePolicies, useWarehouseLocations } from '../hooks/useLookups';
import { getApiErrorMessage } from '../utils/apiError';
import { formatKg, formatMoney } from '../utils/format';
import { ErrorMessage, GlassCard, Notice, btnPrimary, btnSecondary, inputClass, labelClass } from '../components';
import ReceiptDetailModal from './ReceiptDetailModal';

interface LineRow {
  key: number;
  itemType: string;
  weightKg: string;
  accepted: boolean;
  rejectionReason: string;
}

let lineKey = 0;
const newLine = (): LineRow => ({ key: ++lineKey, itemType: '', weightKg: '', accepted: true, rejectionReason: '' });

// Idempotency key: a repeated request with the same key returns the original receipt instead of
// creating a duplicate, so a double-click or a retry after a timeout is harmless.
const newIdempotencyKey = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

const ExtraWasteReceiveForm: React.FC = () => {
  const locations = useWarehouseLocations();
  const collectors = useCollectors();
  const allRates = useRatePolicies();
  // "GeneralCollection" prices job-collection payments; it is not a real item type, so it is never offered here.
  const rateData = useMemo(() => allRates.data.filter((r) => !isReservedExtraWasteType(r.itemType)), [allRates.data]);

  const [collectorId, setCollectorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineRow[]>(() => [newLine()]);
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiveExtraWasteResponse | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState(false);

  useEffect(() => {
    if (!locationId && locations.data.length > 0) {
      const receiving = locations.data.find((l) => /receiv/i.test(l.name)) ?? locations.data[0];
      setLocationId(receiving.id);
    }
  }, [locations.data, locationId]);

  const rateFor = (itemType: string) => rateData.find((r) => r.itemType.toLowerCase() === itemType.trim().toLowerCase());

  const updateLine = (key: number, patch: Partial<LineRow>) =>
    setLines((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Mirrors ReceiveExtraWasteRequestValidator + the service's "accepted items need an active rate" rule.
  const problems = useMemo(() => {
    const out: string[] = [];
    if (!collectorId) out.push('Choose the collector.');
    if (!locationId) out.push('Choose the warehouse location.');
    if (notes.length > LIMITS.notes) out.push(`Notes must be ${LIMITS.notes} characters or fewer.`);
    if (lines.length === 0) out.push('Add at least one item.');
    lines.forEach((l, i) => {
      const n = i + 1;
      if (!l.itemType.trim()) out.push(`Item ${n}: enter an item type.`);
      else if (l.itemType.trim().length > LIMITS.itemType) out.push(`Item ${n}: item type must be ${LIMITS.itemType} characters or fewer.`);
      else if (isReservedExtraWasteType(l.itemType))
        out.push(`Item ${n}: “${l.itemType.trim()}” is reserved for job-collection payments and cannot be used as an extra-waste item.`);
      else if (l.accepted && !rateData.some((r) => r.itemType.toLowerCase() === l.itemType.trim().toLowerCase()))
        out.push(`Item ${n}: “${l.itemType.trim()}” has no active rate policy, so it cannot be accepted.`);
      if (!(Number(l.weightKg) > 0)) out.push(`Item ${n}: weight must be greater than 0.`);
      if (!l.accepted) {
        if (!l.rejectionReason.trim()) out.push(`Item ${n}: give a reason for rejecting it.`);
        else if (l.rejectionReason.length > LIMITS.rejectionReason)
          out.push(`Item ${n}: rejection reason must be ${LIMITS.rejectionReason} characters or fewer.`);
      }
    });
    return out;
  }, [collectorId, locationId, notes, lines, rateData]);

  const acceptedCount = lines.filter((l) => l.accepted).length;
  const estimatedPayment = lines.reduce((sum, l) => {
    const rate = l.accepted ? rateFor(l.itemType) : undefined;
    const w = Number(l.weightKg);
    return rate && w > 0 ? sum + w * rate.ratePerKg : sum;
  }, 0);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await receiveApi.receiveExtraWaste({
        collectorId,
        warehouseLocationId: locationId,
        notes,
        idempotencyKey,
        items: lines.map((l) => ({
          itemType: rateFor(l.itemType)?.itemType ?? l.itemType,
          weightKg: Number(l.weightKg),
          accepted: l.accepted,
          rejectionReason: l.rejectionReason,
        })),
      });
      setResult(res);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to record the receipt.'));
    } finally {
      setSubmitting(false);
    }
  };

  const startNew = () => {
    setResult(null);
    setViewingReceipt(false);
    setCollectorId('');
    setNotes('');
    setLines([newLine()]);
    setSubmitted(false);
    setError(null);
    setIdempotencyKey(newIdempotencyKey());
  };

  // ---------------------------------------------------------------- success view
  if (result) {
    const accepted = result.items.filter((i) => i.accepted).length;
    return (
      <GlassCard>
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-mint-100 text-mint-700">
            <CheckCircle2 size={22} />
          </span>
          <div>
            <h3 className="font-display text-lg font-bold text-ink-900">Receipt recorded</h3>
            <p className="text-sm text-ink-600">
              {accepted} of {result.items.length} item{result.items.length === 1 ? '' : 's'} accepted into inventory
              {accepted > 0 ? ' and one pending payment raised for the collector.' : '. No payment was raised.'}
            </p>
            <p className="mt-1 font-mono text-[11px] text-ink-600">Receipt {result.extraWasteReceiptId}</p>
          </div>
        </div>

        <ul className="mt-5 space-y-2">
          {result.items.map((item, i) => (
            <li key={`${item.itemType}-${i}`} className="flex items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                {item.accepted ? <CheckCircle2 size={16} className="text-mint-600" /> : <XCircle size={16} className="text-red-500" />}
                <span className="font-semibold text-ink-900">{item.itemType}</span>
                {!item.accepted && item.rejectionReason && <span className="text-xs text-ink-600">— {item.rejectionReason}</span>}
              </div>
              {item.inventoryItemId ? (
                <Link to={`/processing/inventory/${item.inventoryItemId}`} className="text-xs font-semibold text-mint-700 hover:underline">
                  Open item
                </Link>
              ) : (
                <span className="text-xs text-ink-600">Rejected</span>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" onClick={startNew} className={btnPrimary}>
            <Plus size={14} /> New receipt
          </button>
          <button type="button" onClick={() => setViewingReceipt(true)} className={btnSecondary}>
            View full receipt
          </button>
          <Link to="/processing/inventory" className={btnSecondary}>
            View inventory
          </Link>
          {accepted > 0 && (
            <Link to="/processing/payments" className={btnSecondary}>
              <Wallet size={14} /> View pending payments
            </Link>
          )}
        </div>
        <ReceiptDetailModal receiptId={viewingReceipt ? result.extraWasteReceiptId : null} onClose={() => setViewingReceipt(false)} />
      </GlassCard>
    );
  }

  // ---------------------------------------------------------------- form view
  const referenceError = collectors.error ?? locations.error ?? allRates.error;

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {referenceError && (
        <ErrorMessage
          message={referenceError}
          onRetry={() => {
            collectors.reload();
            locations.reload();
            allRates.reload();
          }}
        />
      )}

      <GlassCard>
        <h3 className="font-display text-base font-bold text-ink-900">1 · Who delivered, and where to</h3>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="ew-collector">
              Collector
            </label>
            <select id="ew-collector" value={collectorId} onChange={(e) => setCollectorId(e.target.value)} className={inputClass} disabled={collectors.loading}>
              <option value="">{collectors.loading ? 'Loading collectors…' : 'Select a collector…'}</option>
              {collectors.data.map((c) => (
                <option key={c.collectorId} value={c.collectorId}>
                  {c.fullName} · {c.vehicleType}
                </option>
              ))}
            </select>
            {!collectors.loading && collectors.data.length === 0 && !collectors.error && (
              <p className="mt-1 text-xs text-amber-700">No active collectors are registered yet.</p>
            )}
          </div>
          <div>
            <label className={labelClass} htmlFor="ew-location">
              Warehouse location
            </label>
            <select id="ew-location" value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputClass} disabled={locations.loading}>
              {locations.loading && <option value="">Loading…</option>}
              {locations.data.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="ew-notes">
              Notes (optional)
            </label>
            <textarea id="ew-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} placeholder="Anything worth recording about this drop-off…" />
          </div>
        </div>
      </GlassCard>

      <GlassCard>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-ink-900">2 · Items brought in</h3>
            <p className="text-xs text-ink-600">Accepted items become inventory and are paid at their rate per kg. Rejected items are only logged.</p>
          </div>
          <button type="button" onClick={() => setLines((rows) => [...rows, newLine()])} className={btnSecondary}>
            <Plus size={14} /> Add item
          </button>
        </div>

        <datalist id="ew-types">
          {rateData.map((r) => (
            <option key={r.id} value={r.itemType}>
              {formatMoney(r.ratePerKg)} / kg
            </option>
          ))}
        </datalist>

        <div className="mt-4 space-y-3">
          {lines.map((line, i) => {
            const rate = line.accepted ? rateFor(line.itemType) : undefined;
            return (
              <div key={line.key} className={`rounded-2xl border p-3.5 ${line.accepted ? 'border-mint-100 bg-white/60' : 'border-red-200 bg-red-50/50'}`}>
                <div className="grid gap-3 sm:grid-cols-[1fr_130px_auto_auto] sm:items-end">
                  <div>
                    <label className={labelClass} htmlFor={`ew-type-${line.key}`}>
                      Item {i + 1} type
                    </label>
                    <input
                      id={`ew-type-${line.key}`}
                      list="ew-types"
                      value={line.itemType}
                      maxLength={LIMITS.itemType}
                      onChange={(e) => updateLine(line.key, { itemType: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. Laptop"
                    />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`ew-weight-${line.key}`}>
                      Weight (kg)
                    </label>
                    <input
                      id={`ew-weight-${line.key}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={line.weightKg}
                      onChange={(e) => updateLine(line.key, { weightKg: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 pb-2.5 text-sm text-ink-800">
                    <input
                      type="checkbox"
                      checked={line.accepted}
                      onChange={(e) => updateLine(line.key, { accepted: e.target.checked })}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    Accepted
                  </label>
                  <button
                    type="button"
                    onClick={() => setLines((rows) => rows.filter((r) => r.key !== line.key))}
                    disabled={lines.length === 1}
                    aria-label={`Remove item ${i + 1}`}
                    className="mb-1 self-end rounded-full p-2 text-red-600 transition hover:bg-red-50 disabled:opacity-30"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>

                {line.accepted && line.itemType.trim() && (
                  <p className={`mt-2 text-xs ${rate ? 'text-ink-600' : 'text-red-600'}`}>
                    {rate
                      ? `Rate ${formatMoney(rate.ratePerKg)} / kg${Number(line.weightKg) > 0 ? ` → ${formatMoney(Number(line.weightKg) * rate.ratePerKg)}` : ''}`
                      : 'No active rate policy for this item type — pick one from the suggestions, or reject the item.'}
                  </p>
                )}

                {!line.accepted && (
                  <div className="mt-3">
                    <label className={labelClass} htmlFor={`ew-reason-${line.key}`}>
                      Reason for rejecting
                    </label>
                    <input
                      id={`ew-reason-${line.key}`}
                      value={line.rejectionReason}
                      maxLength={LIMITS.rejectionReason}
                      onChange={(e) => updateLine(line.key, { rejectionReason: e.target.value })}
                      className={inputClass}
                      placeholder="e.g. Not e-waste / already damaged beyond recovery"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-mint-100 pt-4 text-sm">
          <span className="text-ink-600">
            {acceptedCount} accepted · {lines.length - acceptedCount} rejected ·{' '}
            {formatKg(lines.reduce((s, l) => s + (Number(l.weightKg) > 0 ? Number(l.weightKg) : 0), 0))} total
          </span>
          <span className="font-semibold text-ink-900">
            Estimated payment: {formatMoney(estimatedPayment)}{' '}
            <span className="text-xs font-normal text-ink-600">(final amount is calculated by the server)</span>
          </span>
        </div>
      </GlassCard>

      {acceptedCount === 0 && lines.length > 0 && (
        <Notice tone="info">Every item is marked as rejected, so no inventory items or payment will be created — only the receipt is logged.</Notice>
      )}

      {submitted && problems.length > 0 && (
        <Notice tone="error" title="Please fix the following">
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
          {submitting ? 'Recording…' : 'Record receipt'}
        </button>
        <button type="button" className={btnSecondary} onClick={startNew} disabled={submitting}>
          Reset form
        </button>
      </div>
    </form>
  );
};

export default ExtraWasteReceiveForm;
