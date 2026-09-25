import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, ReceiptText } from 'lucide-react';
import { receiveApi } from './receiveApi';
import ReceiptDetailModal from './ReceiptDetailModal';
import type { ReceiptListResponse } from './types';
import { LIMITS } from '../processingEnums';
import { useCollectors } from '../hooks/useLookups';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, formatKg, formatMoney } from '../utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Pagination,
  StatusBadge,
  btnSecondary,
  btnSmall,
  inputClass,
  tableCellClass,
  tableHeadClass,
} from '../components';

/**
 * History of extra-waste receipts. A receipt where every line was rejected creates no inventory
 * and no payment, so this list is the only place such a receipt can still be seen afterwards.
 */
const ReceiptHistoryTab: React.FC = () => {
  const collectors = useCollectors();
  const [collectorId, setCollectorId] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ReceiptListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openReceipt, setOpenReceipt] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const result = await receiveApi.listReceipts({ collectorId: collectorId || undefined, page, pageSize: LIMITS.pageSize });
      if (id === requestId.current) setData(result);
    } catch (e) {
      if (id === requestId.current) setError(getApiErrorMessage(e, 'Failed to load receipt history.'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [collectorId, page]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.items ?? [];

  return (
    <div>
      <GlassCard className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <select
            aria-label="Collector"
            value={collectorId}
            onChange={(e) => {
              setCollectorId(e.target.value);
              setPage(1);
            }}
            className={`${inputClass} !w-auto min-w-[14rem]`}
          >
            <option value="">All collectors</option>
            {collectors.data.map((c) => (
              <option key={c.collectorId} value={c.collectorId}>
                {c.fullName} · {c.vehicleType}
              </option>
            ))}
          </select>
          <button type="button" onClick={load} className={btnSecondary} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </GlassCard>

      <GlassCard padded={false}>
        {error ? (
          <div className="p-5">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        ) : loading && !data ? (
          <LoadingState label="Loading receipts…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No receipts yet" description="Extra-waste drop-offs you record appear here, including any rejected items." />
        ) : (
          <>
            <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
              <table className="w-full min-w-[820px] border-collapse">
                <thead>
                  <tr className="border-b border-mint-100">
                    <th className={`${tableHeadClass} px-4 py-3`}>Received</th>
                    <th className={`${tableHeadClass} px-4 py-3`}>Collector</th>
                    <th className={`${tableHeadClass} px-4 py-3`}>Lines</th>
                    <th className={`${tableHeadClass} px-4 py-3 text-right`}>Weight (accepted / total)</th>
                    <th className={`${tableHeadClass} px-4 py-3`}>Payment</th>
                    <th className={`${tableHeadClass} px-4 py-3 text-right`}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.receiptId}
                      onClick={() => setOpenReceipt(r.receiptId)}
                      className="cursor-pointer border-b border-mint-50 transition-colors last:border-0 hover:bg-mint-50/70"
                    >
                      <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateTime(r.receivedAt)}</td>
                      <td className={`${tableCellClass} font-semibold text-ink-900`}>{r.collectorName ?? 'Unknown collector'}</td>
                      <td className={tableCellClass}>
                        <span className="rounded-full bg-mint-100 px-2 py-0.5 text-xs font-semibold text-mint-800">{r.acceptedCount} accepted</span>{' '}
                        {r.rejectedCount > 0 && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">{r.rejectedCount} rejected</span>
                        )}
                      </td>
                      <td className={`${tableCellClass} text-right font-mono`}>
                        {formatKg(r.acceptedWeightKg)} / {formatKg(r.totalWeightKg)}
                      </td>
                      <td className={tableCellClass}>
                        {r.paymentAmount !== null && r.paymentStatus ? (
                          <span className="flex items-center gap-2">
                            <span className="font-mono font-semibold">{formatMoney(r.paymentAmount)}</span>
                            <StatusBadge status={r.paymentStatus} />
                          </span>
                        ) : (
                          <span className="text-xs text-ink-600">No payment (all rejected)</span>
                        )}
                      </td>
                      <td className={`${tableCellClass} text-right`}>
                        <button
                          type="button"
                          className={`${btnSecondary} ${btnSmall}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenReceipt(r.receiptId);
                          }}
                        >
                          View
                        </button>
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
                onPageChange={setPage}
              />
            </div>
          </>
        )}
      </GlassCard>

      <ReceiptDetailModal receiptId={openReceipt} onClose={() => setOpenReceipt(null)} />
    </div>
  );
};

export default ReceiptHistoryTab;
