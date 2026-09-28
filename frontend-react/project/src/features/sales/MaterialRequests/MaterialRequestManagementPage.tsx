/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { materialRequestApi } from './materialRequestApi';
import type { MaterialRequest } from './types';
import {
  EmptyState, ErrorMessage, GlassCard, LoadingState, PageHeader,
  btnSecondary, tableCellClass, tableHeadClass,
} from '../../../components/ui';

const MaterialRequestManagementPage: React.FC = () => {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await materialRequestApi.listAll());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Could not load buyer requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div>
      <PageHeader
        title="Buyer material demand"
        subtitle="Track backordered demand and open generated plans for admin review."
        icon={ClipboardList}
        actions={<button onClick={() => void load()} className={btnSecondary} title="Refresh requests" aria-label="Refresh requests"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>}
      />

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !requests.length ? (
          <LoadingState label="Loading requests…" />
        ) : !error && requests.length === 0 ? (
          <EmptyState icon={ClipboardList} title="No buyer requests have been submitted" />
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Buyer</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Material</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Quantity</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Submitted</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Matching note</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Plan review</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr key={request.materialRequestId} className="border-b border-mint-50 last:border-0">
                    <td className={tableCellClass}>{request.buyerCompanyName}</td>
                    <td className={`${tableCellClass} font-semibold text-ink-900`}>{request.materialType}</td>
                    <td className={tableCellClass}>{request.quantityKg.toLocaleString()} kg</td>
                    <td className={tableCellClass}>
                      <span className="rounded-full bg-mint-50 px-2.5 py-1 text-xs font-bold text-mint-800 whitespace-nowrap">{statusLabel(request.status)}</span>
                    </td>
                    <td className={`${tableCellClass} text-ink-600`}>{new Date(request.createdAt).toLocaleString()}</td>
                    <td className={tableCellClass}>{request.lastMatchingNote ?? '—'}</td>
                    <td className={tableCellClass}>
                      {request.commercialPlanId ? <Link to={`/plans/${request.commercialPlanId}`} className="font-semibold text-mint-700 hover:underline">Review plan</Link> : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
};

const statusLabel = (status: MaterialRequest['status']) => ({
  Waiting: 'Waiting for stock',
  WaitingForPrice: 'Waiting for approved price',
  GeneratingPlan: 'Preparing plan',
  PlanGenerated: 'Awaiting admin approval',
  PlanGenerationFailed: 'Plan generation retrying',
  OrderPlaced: 'Order placed',
  Fulfilled: 'Fulfilled',
  Cancelled: 'Cancelled',
})[status];

export default MaterialRequestManagementPage;
