/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { PackagePlus, RefreshCw, X } from 'lucide-react';
import { materialRequestApi } from './materialRequestApi';
import type { MaterialRequest } from './types';
import {
  EmptyState, ErrorMessage, GlassCard, LoadingState, PageHeader, StatusPill,
  btnPrimary, btnSecondary, inputClass, labelClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';
import type { StatusTone } from '../../../components/ui/StatusPill';

const STATUS_TONE: Record<MaterialRequest['status'], StatusTone> = {
  Waiting: 'warning',
  WaitingForPrice: 'warning',
  GeneratingPlan: 'info',
  PlanGenerated: 'success',
  PlanGenerationFailed: 'error',
  OrderPlaced: 'success',
  Fulfilled: 'success',
  Cancelled: 'neutral',
};

const STATUS_LABEL: Record<MaterialRequest['status'], string> = {
  Waiting: 'Waiting',
  WaitingForPrice: 'Waiting for approved price',
  GeneratingPlan: 'Preparing plan',
  PlanGenerated: 'Awaiting admin approval',
  PlanGenerationFailed: 'Plan generation retrying',
  OrderPlaced: 'Order placed',
  Fulfilled: 'Fulfilled',
  Cancelled: 'Cancelled',
};

const MaterialRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [materialType, setMaterialType] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await materialRequestApi.listMine());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Could not load your material requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await materialRequestApi.create({ materialType: materialType.trim(), quantityKg: Number(quantityKg) });
      setMaterialType('');
      setQuantityKg('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Could not submit your request.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (request: MaterialRequest) => {
    try {
      await materialRequestApi.cancel(request.materialRequestId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Could not cancel this request.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Material requests"
        subtitle="Request material even when stock is not available. We'll prepare a sales plan when it is restocked."
        icon={PackagePlus}
        actions={
          <button onClick={() => void load()} className={btnSecondary} title="Refresh requests" aria-label="Refresh requests">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        }
      />

      {error && <ErrorMessage message={error} className="mb-4" />}

      <GlassCard hover={false} className="p-5">
        <form onSubmit={submit} className="grid items-end gap-4 sm:grid-cols-[minmax(180px,1fr)_minmax(150px,220px)_auto]">
          <label className="grid gap-1.5">
            <span className={labelClass}>Material type</span>
            <input
              value={materialType}
              onChange={(event) => setMaterialType(event.target.value)}
              maxLength={100}
              placeholder="e.g. Copper"
              required
              className={inputClass}
            />
          </label>
          <label className="grid gap-1.5">
            <span className={labelClass}>Quantity (kg)</span>
            <input
              type="number"
              min="0.001"
              max="1000000"
              step="0.001"
              value={quantityKg}
              onChange={(event) => setQuantityKg(event.target.value)}
              required
              className={inputClass}
            />
          </label>
          <button type="submit" disabled={saving} className={btnPrimary}>
            <PackagePlus size={15} /> {saving ? 'Submitting…' : 'Request material'}
          </button>
        </form>
      </GlassCard>

      <div className="mb-3 mt-7 flex items-center justify-between">
        <h3 className="font-display text-lg font-bold text-ink-900">Your requests</h3>
        <span className="text-sm text-ink-600">{requests.length} total</span>
      </div>

      <GlassCard hover={false} padded={false}>
        {loading && !requests.length ? (
          <LoadingState label="Loading requests…" />
        ) : requests.length === 0 ? (
          <EmptyState icon={PackagePlus} title="No material requests yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Material</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Quantity</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Requested</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Plan / matching note</th>
                  <th className={`${tableHeadClass} px-4 py-3`}></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.materialRequestId} className="border-b border-mint-50 last:border-0">
                    <td className={`${tableCellClass} font-semibold text-ink-900`}>{request.materialType}</td>
                    <td className={tableCellClass}>{request.quantityKg.toLocaleString()} kg</td>
                    <td className={tableCellClass}>
                      <StatusPill label={STATUS_LABEL[request.status]} tone={STATUS_TONE[request.status]} />
                    </td>
                    <td className={tableCellClass}>{new Date(request.createdAt).toLocaleDateString()}</td>
                    <td className={tableCellClass}>
                      {request.lastMatchingNote ?? (request.commercialPlanId ? 'Awaiting admin review' : request.status === 'PlanGenerationFailed' ? 'Retry scheduled' : '—')}
                    </td>
                    <td className={tableCellClass}>
                      {['Waiting', 'WaitingForPrice', 'PlanGenerationFailed'].includes(request.status) && (
                        <button
                          onClick={() => void cancel(request)}
                          className="inline-grid h-8 w-8 place-items-center rounded-lg border border-red-200 bg-white text-red-600 hover:bg-red-50"
                          title="Cancel request"
                          aria-label="Cancel request"
                        >
                          <X size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default MaterialRequestsPage;
