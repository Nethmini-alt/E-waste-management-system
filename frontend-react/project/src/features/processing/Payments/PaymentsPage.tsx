import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, RefreshCw, Wallet, X } from 'lucide-react';
import { paymentApi } from './paymentApi';
import MarkPaidModal from './MarkPaidModal';
import PaymentDetailModal from './PaymentDetailModal';
import type { PaymentListItem, PaymentListResponse } from './types';
import {
  LIMITS,
  PAYMENT_SOURCE_TYPES,
  PAYMENT_SOURCE_TYPE_LABELS,
  isPaymentSourceType,
  type PaymentStatus,
} from '../processingEnums';
import { useCollectors } from '../hooks/useLookups';
import { useSearchParams } from 'react-router-dom';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, formatMoney, shortId } from '../utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Notice,
  PageHeader,
  Pagination,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  btnSmall,
  inputClass,
  tableCellClass,
  tableHeadClass,
} from '../components';

type Tab = 'pending' | 'paid' | 'all';

const TABS: { id: Tab; label: string; status?: PaymentStatus }[] = [
  { id: 'pending', label: 'Pending payments', status: 'Pending' },
  { id: 'paid', label: 'Payment history', status: 'Paid' },
  { id: 'all', label: 'All' },
];

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PaymentsPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const collectors = useCollectors();

  const tabParam = params.get('tab');
  const tab: Tab = tabParam === 'paid' || tabParam === 'all' ? tabParam : 'pending';
  const tabStatus = TABS.find((t) => t.id === tab)?.status;
  const collectorParam = params.get('collector');
  const collectorId = collectorParam && GUID_RE.test(collectorParam) ? collectorParam : undefined;
  const sourceParam = params.get('source');
  const sourceType = isPaymentSourceType(sourceParam) ? sourceParam : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1);
  // The open payment lives in the URL, so a payment can be linked to (e.g. from a receipt) and Back closes it.
  const paymentParam = params.get('payment');
  const openPaymentId = paymentParam && GUID_RE.test(paymentParam) ? paymentParam : null;

  const [data, setData] = useState<PaymentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [paying, setPaying] = useState<PaymentListItem | null>(null);
  const requestId = useRef(0);

  const updateParams = useCallback(
    (changes: Record<string, string | null>) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(changes).forEach(([key, value]) => {
          if (value === null || value === '') next.delete(key);
          else next.set(key, value);
        });
        if (!('page' in changes)) next.delete('page');
        return next;
      });
    },
    [setParams],
  );

  // Opens/closes the detail dialog without disturbing the tab, filters or page.
  const setOpenPayment = useCallback(
    (id: string | null) => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        if (id) next.set('payment', id);
        else next.delete('payment');
        return next;
      });
    },
    [setParams],
  );

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await paymentApi.list({ status: tabStatus, collectorId, sourceType, page, pageSize: LIMITS.pageSize });
      if (id === requestId.current) setData(result);
    } catch (e) {
      if (id === requestId.current) setError(getApiErrorMessage(e, 'Failed to load payments.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [tabStatus, collectorId, sourceType, page]);

  useEffect(() => {
    load();
  }, [load]);

  const filtersActive = Boolean(collectorId || sourceType);
  const rows = data?.items ?? [];

  const handlePaid = (message: string) => {
    setPaying(null);
    setNotice(message);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Collector payments"
        subtitle="Payments raised when waste is received. Mark a payment as paid once the collector has been settled."
        icon={Wallet}
        actions={
          <button type="button" onClick={load} className={btnSecondary} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {/* Totals */}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <GlassCard>
          <p className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-ink-600">
            <Clock size={12} /> Total pending
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-ink-900">{data ? formatMoney(data.totalPendingAmount) : '—'}</p>
          <p className="text-xs text-ink-600">{filtersActive ? 'For the selected collector / source' : 'Across all collectors'}</p>
        </GlassCard>
        <GlassCard>
          <p className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wide text-ink-600">
            <CheckCircle2 size={12} /> Total paid
          </p>
          <p className="mt-1 font-display text-2xl font-bold text-ink-900">{data ? formatMoney(data.totalPaidAmount) : '—'}</p>
          <p className="text-xs text-ink-600">{filtersActive ? 'For the selected collector / source' : 'Across all collectors'}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">In this view</p>
          <p className="mt-1 font-display text-2xl font-bold text-ink-900">{data ? data.totalCount : '—'}</p>
          <p className="text-xs text-ink-600">payment{data?.totalCount === 1 ? '' : 's'}</p>
        </GlassCard>
      </div>

      {notice && (
        <Notice tone="success" className="mb-4">
          {notice}
        </Notice>
      )}

      {/* Tabs + filters */}
      <GlassCard className="mb-4">
        <div role="tablist" aria-label="Payment status" className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => updateParams({ tab: t.id === 'pending' ? null : t.id })}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? 'bg-mint-600 text-white shadow-md shadow-mint-500/30' : 'text-ink-800 hover:bg-mint-50'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <select aria-label="Collector" value={collectorId ?? ''} onChange={(e) => updateParams({ collector: e.target.value })} className={inputClass}>
            <option value="">All collectors</option>
            {collectors.data.map((c) => (
              <option key={c.collectorId} value={c.collectorId}>
                {c.fullName} · {c.vehicleType}
              </option>
            ))}
          </select>
          <select aria-label="Source" value={sourceType ?? ''} onChange={(e) => updateParams({ source: e.target.value })} className={inputClass}>
            <option value="">All sources</option>
            {PAYMENT_SOURCE_TYPES.map((s) => (
              <option key={s} value={s}>
                {PAYMENT_SOURCE_TYPE_LABELS[s]}
              </option>
            ))}
          </select>
          {filtersActive && (
            <button type="button" onClick={() => updateParams({ collector: null, source: null })} className="inline-flex items-center gap-1 self-center text-xs font-semibold text-mint-700 hover:underline">
              <X size={12} /> Clear filters
            </button>
          )}
        </div>
        {collectors.error && <ErrorMessage className="mt-3" message={collectors.error} onRetry={collectors.reload} />}
      </GlassCard>

      {/* Table */}
      <GlassCard padded={false}>
        {error ? (
          <div className="p-5">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        ) : loading && !data ? (
          <LoadingState label="Loading payments…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={tab === 'pending' ? 'Nothing pending' : tab === 'paid' ? 'No payment history yet' : 'No payments'}
            description={
              filtersActive
                ? 'No payments match the selected collector / source.'
                : tab === 'pending'
                  ? 'Every collector is settled. New payments appear when waste is received.'
                  : 'Payments show up here once waste has been received and paid.'
            }
            action={
              filtersActive ? (
                <button type="button" onClick={() => updateParams({ collector: null, source: null })} className={btnSecondary}>
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="border-b border-mint-100">
                    <th className={`${tableHeadClass} px-4 py-3`}>Collector</th>
                    <th className={`${tableHeadClass} px-4 py-3`}>Source</th>
                    <th className={`${tableHeadClass} px-4 py-3 text-right`}>Amount</th>
                    <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                    <th className={`${tableHeadClass} px-4 py-3`}>Raised</th>
                    <th className={`${tableHeadClass} px-4 py-3`}>Paid on</th>
                    <th className={`${tableHeadClass} px-4 py-3 text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => setOpenPayment(p.id)}
                      className="cursor-pointer border-b border-mint-50 transition-colors last:border-0 hover:bg-mint-50/70"
                    >
                      <td className={tableCellClass}>
                        <div className="font-semibold text-ink-900">{p.collectorName ?? `Collector ${shortId(p.collectorId)}`}</div>
                        {p.collectorVehicleType && <div className="text-[11px] text-ink-600">{p.collectorVehicleType}</div>}
                      </td>
                      <td className={tableCellClass}>
                        <div>{PAYMENT_SOURCE_TYPE_LABELS[p.sourceType] ?? p.sourceType}</div>
                        <div className="font-mono text-[11px] text-ink-600" title={p.sourceId}>
                          {shortId(p.sourceId)}
                        </div>
                      </td>
                      <td className={`${tableCellClass} text-right font-mono font-semibold`}>{formatMoney(p.amount)}</td>
                      <td className={tableCellClass}>
                        <StatusBadge status={p.status} />
                      </td>
                      <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateTime(p.createdAt)}</td>
                      <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateTime(p.paidAt)}</td>
                      <td className={`${tableCellClass} text-right`}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            className={`${btnSecondary} ${btnSmall}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenPayment(p.id);
                            }}
                          >
                            Details
                          </button>
                          {p.status === 'Pending' && (
                            <button
                              type="button"
                              className={`${btnPrimary} ${btnSmall}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setPaying(p);
                              }}
                            >
                              Mark paid
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 pb-4">
              <Pagination
                page={data?.page ?? page}
                totalPages={data?.totalPages ?? 1}
                totalCount={data?.totalCount ?? 0}
                pageSize={data?.pageSize ?? LIMITS.pageSize}
                disabled={loading}
                onPageChange={(p) => updateParams({ page: p === 1 ? null : String(p) })}
              />
            </div>
          </>
        )}
      </GlassCard>

      <MarkPaidModal payment={paying} onClose={() => setPaying(null)} onDone={handlePaid} onStale={load} />
      <PaymentDetailModal paymentId={openPaymentId} onClose={() => setOpenPayment(null)} onChanged={load} />
    </div>
  );
};

export default PaymentsPage;
