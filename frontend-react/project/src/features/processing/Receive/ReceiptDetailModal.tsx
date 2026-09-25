import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Wallet, XCircle } from 'lucide-react';
import { receiveApi } from './receiveApi';
import type { ReceiptDetail } from './types';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, formatKg, formatMoney } from '../utils/format';
import { ErrorMessage, LoadingState, Modal, Notice, StatusBadge, btnSecondary, tableCellClass, tableHeadClass } from '../components';

interface ReceiptDetailModalProps {
  /** The receipt to show; null keeps the dialog closed. */
  receiptId: string | null;
  onClose: () => void;
}

/**
 * One extra-waste receipt in full: every line the collector brought — accepted AND rejected — with
 * the rejection reasons and what each line contributed to the payment (rejected lines are always
 * Rs. 0). Rates and amounts come from the payment's saved snapshot, never from today's rates.
 */
const ReceiptDetailModal: React.FC<ReceiptDetailModalProps> = ({ receiptId, onClose }) => {
  const [receipt, setReceipt] = useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!receiptId) return;
    setLoading(true);
    setError(null);
    try {
      setReceipt(await receiveApi.getReceipt(receiptId));
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load this receipt.'));
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    setReceipt(null);
    load();
  }, [load]);

  const accepted = receipt?.items.filter((i) => i.accepted) ?? [];
  const rejected = receipt?.items.filter((i) => !i.accepted) ?? [];

  return (
    <Modal
      open={receiptId !== null}
      onClose={onClose}
      title="Extra-waste receipt"
      subtitle={receipt ? `Received ${formatDateTime(receipt.receivedAt)}` : undefined}
      size="xl"
      footer={
        <button type="button" className={btnSecondary} onClick={onClose}>
          Close
        </button>
      }
    >
      {loading && !receipt ? (
        <LoadingState label="Loading receipt…" />
      ) : error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : receipt ? (
        <div className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/60 p-3.5">
              <dt className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Collector</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink-900">{receipt.collectorName ?? 'Unknown collector'}</dd>
              {receipt.collectorVehicleType && <dd className="text-xs text-ink-600">{receipt.collectorVehicleType}</dd>}
            </div>
            <div className="rounded-2xl bg-white/60 p-3.5">
              <dt className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Received by</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink-900">{receipt.receivedByName ?? 'Not recorded'}</dd>
              <dd className="text-xs text-ink-600">{formatDateTime(receipt.receivedAt)}</dd>
            </div>
            <div className="rounded-2xl bg-white/60 p-3.5">
              <dt className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Lines</dt>
              <dd className="mt-0.5 text-sm font-semibold text-ink-900">
                {receipt.acceptedCount} accepted · {receipt.rejectedCount} rejected
              </dd>
              <dd className="text-xs text-ink-600">
                {formatKg(receipt.acceptedWeightKg)} accepted of {formatKg(receipt.totalWeightKg)}
              </dd>
            </div>
          </dl>

          {receipt.notes && (
            <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-ink-800">
              <span className="font-mono text-[11px] uppercase tracking-wide text-ink-600">Notes · </span>
              {receipt.notes}
            </p>
          )}

          {/* Payment summary */}
          {receipt.payment ? (
            <Notice tone={receipt.payment.hasSnapshot ? 'info' : 'warning'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Wallet size={15} />
                  Payment {formatMoney(receipt.payment.amount)} <StatusBadge status={receipt.payment.status} />
                  {!receipt.payment.hasSnapshot && <span>— no saved breakdown, so rates and line amounts are not shown.</span>}
                </span>
                <Link to={`/processing/payments?tab=all&payment=${receipt.payment.paymentId}`} className="text-xs font-semibold underline underline-offset-2" onClick={onClose}>
                  Open payment
                </Link>
              </div>
            </Notice>
          ) : (
            <Notice tone="info">Every line was rejected, so no inventory items and no payment were created for this receipt.</Notice>
          )}

          {/* Accepted */}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold text-ink-900">
              <CheckCircle2 size={15} className="text-mint-600" /> Accepted — counted in the payment
            </h4>
            {accepted.length === 0 ? (
              <p className="text-sm text-ink-600">No accepted lines.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-mint-100 bg-white/60">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr className="border-b border-mint-100">
                      <th className={`${tableHeadClass} px-4 py-2`}>Item</th>
                      <th className={`${tableHeadClass} px-4 py-2 text-right`}>Weight</th>
                      <th className={`${tableHeadClass} px-4 py-2 text-right`}>Rate</th>
                      <th className={`${tableHeadClass} px-4 py-2 text-right`}>Contributed</th>
                      <th className={`${tableHeadClass} px-4 py-2`} />
                    </tr>
                  </thead>
                  <tbody>
                    {accepted.map((line) => (
                      <tr key={line.id} className="border-b border-mint-50 last:border-0">
                        <td className={`${tableCellClass} font-semibold text-ink-900`}>{line.itemType}</td>
                        <td className={`${tableCellClass} text-right font-mono`}>{formatKg(line.weightKg)}</td>
                        <td className={`${tableCellClass} text-right font-mono`}>
                          {line.ratePerKg !== null ? `${formatMoney(line.ratePerKg)} / kg` : '—'}
                        </td>
                        <td className={`${tableCellClass} text-right font-mono font-semibold`}>
                          {line.lineAmount !== null ? formatMoney(line.lineAmount) : 'Not recorded'}
                        </td>
                        <td className={`${tableCellClass} text-right`}>
                          {line.inventoryItemId && (
                            <Link to={`/processing/inventory/${line.inventoryItemId}`} onClick={onClose} className="text-xs font-semibold text-mint-700 hover:underline">
                              Inventory item
                            </Link>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Rejected */}
          <section>
            <h4 className="mb-2 flex items-center gap-1.5 font-display text-sm font-bold text-ink-900">
              <XCircle size={15} className="text-red-500" /> Rejected — not counted (Rs. 0.00)
            </h4>
            {rejected.length === 0 ? (
              <p className="text-sm text-ink-600">No lines were rejected.</p>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-red-100 bg-red-50/40">
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr className="border-b border-red-100">
                      <th className={`${tableHeadClass} px-4 py-2`}>Item</th>
                      <th className={`${tableHeadClass} px-4 py-2 text-right`}>Weight</th>
                      <th className={`${tableHeadClass} px-4 py-2`}>Reason</th>
                      <th className={`${tableHeadClass} px-4 py-2 text-right`}>Contributed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rejected.map((line) => (
                      <tr key={line.id} className="border-b border-red-50 last:border-0">
                        <td className={`${tableCellClass} font-semibold text-ink-900`}>{line.itemType}</td>
                        <td className={`${tableCellClass} text-right font-mono`}>{formatKg(line.weightKg)}</td>
                        <td className={tableCellClass}>{line.rejectionReason || '—'}</td>
                        <td className={`${tableCellClass} text-right font-mono font-semibold`}>{formatMoney(0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {receipt.payment && receipt.payment.hasSnapshot && (
            <p className="text-xs text-ink-600">
              Rates and amounts are the ones saved when the payment was created; they are not recalculated from current rates.
            </p>
          )}
        </div>
      ) : null}
    </Modal>
  );
};

export default ReceiptDetailModal;
