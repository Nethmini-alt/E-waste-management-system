import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, ReceiptText, XCircle } from 'lucide-react';
import { paymentApi } from './paymentApi';
import MarkPaidModal from './MarkPaidModal';
import type { ExtraWasteLineSnapshot, JobCalculationSnapshot, PaymentDetail } from './types';
import ReceiptDetailModal from '../Receive/ReceiptDetailModal';
import { PAYMENT_SOURCE_TYPE_LABELS } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, formatKg, formatMoney, formatSignedKg, shortId } from '../utils/format';
import {
  ErrorMessage,
  LoadingState,
  Modal,
  Notice,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  tableCellClass,
  tableHeadClass,
} from '../components';

interface PaymentDetailModalProps {
  /** The payment to show; null keeps the dialog closed. */
  paymentId: string | null;
  onClose: () => void;
  /** Called after the payment is marked paid, so the list behind can refresh. */
  onChanged: () => void;
}

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-2xl bg-white/60 p-3.5">
    <dt className="text-[11px] font-mono uppercase tracking-wide text-ink-600">{label}</dt>
    <dd className="mt-0.5 text-sm text-ink-900">{children}</dd>
  </div>
);

const JobBreakdown: React.FC<{ job: JobCalculationSnapshot; total: number }> = ({ job, total }) => (
  <div className="overflow-x-auto rounded-2xl border border-mint-100 bg-white/60">
    <table className="w-full min-w-[480px] border-collapse">
      <thead>
        <tr className="border-b border-mint-100">
          <th className={`${tableHeadClass} px-4 py-2`}>Component</th>
          <th className={`${tableHeadClass} px-4 py-2`}>Calculation</th>
          <th className={`${tableHeadClass} px-4 py-2 text-right`}>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-mint-50">
          <td className={`${tableCellClass} font-semibold`}>Base fee</td>
          <td className={`${tableCellClass} text-ink-600`}>Flat fee per job</td>
          <td className={`${tableCellClass} text-right font-mono`}>{formatMoney(job.baseFee)}</td>
        </tr>
        <tr className="border-b border-mint-50">
          <td className={`${tableCellClass} font-semibold`}>Weight</td>
          <td className={`${tableCellClass} text-ink-600`}>
            {formatKg(job.verifiedWeightKg)} × {formatMoney(job.ratePerKg)} / kg
            <span className="block text-[11px]">Rate: {job.weightRateItemType}</span>
          </td>
          <td className={`${tableCellClass} text-right font-mono`}>{formatMoney(job.weightAmount)}</td>
        </tr>
        <tr className="border-b border-mint-50">
          <td className={`${tableCellClass} font-semibold`}>Distance</td>
          <td className={`${tableCellClass} text-ink-600`}>
            {job.distanceKm === null ? (
              <>No distance recorded — counted as 0 km</>
            ) : (
              <>
                {job.distanceUsedKm} km × {formatMoney(job.distanceRatePerKm)} / km
              </>
            )}
          </td>
          <td className={`${tableCellClass} text-right font-mono`}>{formatMoney(job.distanceAmount)}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-mint-200">
          <td className={`${tableCellClass} font-bold`} colSpan={2}>
            Total
          </td>
          <td className={`${tableCellClass} text-right font-mono font-bold`}>{formatMoney(total)}</td>
        </tr>
      </tfoot>
    </table>
    <p className="border-t border-mint-50 px-4 py-2 text-[11px] text-ink-600">
      Verified weight {formatKg(job.verifiedWeightKg)}
      {job.reportedWeightKg !== null && (
        <>
          {' '}
          · reported by the collector {formatKg(job.reportedWeightKg)}
          {job.discrepancyKg !== null && Math.abs(job.discrepancyKg) >= 0.005 && <> · difference {formatSignedKg(job.discrepancyKg)}</>}
        </>
      )}
    </p>
  </div>
);

const ExtraWasteBreakdown: React.FC<{ lines: ExtraWasteLineSnapshot[]; total: number }> = ({ lines, total }) => {
  const accepted = lines.filter((l) => l.accepted);
  const rejected = lines.filter((l) => !l.accepted);
  const acceptedSum = accepted.reduce((s, l) => s + l.amount, 0);
  const roundedDiffers = Math.abs(acceptedSum - total) >= 0.005;

  return (
    <div className="space-y-4">
      <section>
        <h5 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-900">
          <CheckCircle2 size={14} className="text-mint-600" /> Accepted items — counted in the payment
        </h5>
        <div className="overflow-x-auto rounded-2xl border border-mint-100 bg-white/60">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr className="border-b border-mint-100">
                <th className={`${tableHeadClass} px-4 py-2`}>Item</th>
                <th className={`${tableHeadClass} px-4 py-2 text-right`}>Weight</th>
                <th className={`${tableHeadClass} px-4 py-2 text-right`}>Rate used</th>
                <th className={`${tableHeadClass} px-4 py-2 text-right`}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {accepted.map((l, i) => (
                <tr key={l.receiptItemId ?? `${l.itemType}-${i}`} className="border-b border-mint-50 last:border-0">
                  <td className={`${tableCellClass} font-semibold`}>{l.itemType}</td>
                  <td className={`${tableCellClass} text-right font-mono`}>{formatKg(l.weightKg)}</td>
                  <td className={`${tableCellClass} text-right font-mono`}>{l.ratePerKg !== null ? `${formatMoney(l.ratePerKg)} / kg` : '—'}</td>
                  <td className={`${tableCellClass} text-right font-mono`}>{formatMoney(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-mint-200">
                <td className={`${tableCellClass} font-bold`} colSpan={3}>
                  Total
                </td>
                <td className={`${tableCellClass} text-right font-mono font-bold`}>{formatMoney(total)}</td>
              </tr>
            </tfoot>
          </table>
          {roundedDiffers && <p className="border-t border-mint-50 px-4 py-2 text-[11px] text-ink-600">Line amounts are shown unrounded; the total is rounded once to 2 decimals.</p>}
        </div>
      </section>

      <section>
        <h5 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink-900">
          <XCircle size={14} className="text-red-500" /> Rejected items — not counted (Rs. 0.00)
        </h5>
        {rejected.length === 0 ? (
          <p className="text-sm text-ink-600">No items were rejected on this receipt.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-red-100 bg-red-50/40">
            <table className="w-full min-w-[480px] border-collapse">
              <thead>
                <tr className="border-b border-red-100">
                  <th className={`${tableHeadClass} px-4 py-2`}>Item</th>
                  <th className={`${tableHeadClass} px-4 py-2 text-right`}>Weight</th>
                  <th className={`${tableHeadClass} px-4 py-2`}>Reason</th>
                  <th className={`${tableHeadClass} px-4 py-2 text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {rejected.map((l, i) => (
                  <tr key={l.receiptItemId ?? `${l.itemType}-${i}`} className="border-b border-red-50 last:border-0">
                    <td className={`${tableCellClass} font-semibold`}>{l.itemType}</td>
                    <td className={`${tableCellClass} text-right font-mono`}>{formatKg(l.weightKg)}</td>
                    <td className={tableCellClass}>{l.rejectionReason || '—'}</td>
                    <td className={`${tableCellClass} text-right font-mono`}>{formatMoney(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

/**
 * Everything about one payment. The amount and its breakdown are the ones SAVED when the payment was
 * created — nothing here is recalculated from today's rates. Payments created before snapshots existed
 * say so instead of inventing a breakdown.
 */
const PaymentDetailModal: React.FC<PaymentDetailModalProps> = ({ paymentId, onClose, onChanged }) => {
  const [payment, setPayment] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingPay, setConfirmingPay] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!paymentId) return;
    setLoading(true);
    setError(null);
    try {
      setPayment(await paymentApi.get(paymentId));
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load this payment.'));
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    setPayment(null);
    setNotice(null);
    load();
  }, [load]);

  const snapshot = payment?.snapshot ?? null;

  return (
    <>
      <Modal
        open={paymentId !== null}
        onClose={onClose}
        title="Payment details"
        subtitle={payment ? `${PAYMENT_SOURCE_TYPE_LABELS[payment.sourceType]} · ${shortId(payment.id)}` : undefined}
        size="xl"
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={onClose}>
              Close
            </button>
            {payment?.status === 'Pending' && (
              <button type="button" className={btnPrimary} onClick={() => setConfirmingPay(true)}>
                Mark as paid
              </button>
            )}
          </>
        }
      >
        {loading && !payment ? (
          <LoadingState label="Loading payment…" />
        ) : error ? (
          <ErrorMessage message={error} onRetry={load} />
        ) : payment ? (
          <div className="space-y-5">
            {notice && <Notice tone="success">{notice}</Notice>}

            {/* Amount + status */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-mint-50 to-white/60 p-4">
              <div>
                <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Final amount</p>
                <p className="font-display text-3xl font-bold text-ink-900">{formatMoney(payment.amount)}</p>
              </div>
              <StatusBadge status={payment.status} className="!text-sm" />
            </div>

            {/* Who / when */}
            <dl className="grid gap-3 sm:grid-cols-3">
              <Field label="Collector">
                <span className="font-semibold">{payment.collectorName ?? `Collector ${shortId(payment.collectorId)}`}</span>
                {payment.collectorVehicleType && <span className="block text-xs text-ink-600">{payment.collectorVehicleType}</span>}
              </Field>
              <Field label="Created">
                {formatDateTime(payment.createdAt)}
                <span className="block text-xs text-ink-600">by {payment.createdByName ?? 'Not recorded (before audit tracking)'}</span>
              </Field>
              <Field label="Paid">
                {payment.paidAt ? formatDateTime(payment.paidAt) : 'Not paid yet'}
                {payment.paidAt && <span className="block text-xs text-ink-600">by {payment.paidByName ?? 'Not recorded'}</span>}
              </Field>
            </dl>

            {/* Source */}
            <section>
              <h4 className="mb-2 font-display text-sm font-bold text-ink-900">Source · {PAYMENT_SOURCE_TYPE_LABELS[payment.sourceType]}</h4>
              {payment.job ? (
                <dl className="grid gap-3 sm:grid-cols-3">
                  <Field label="Job">
                    <span className="break-all font-mono text-xs">{payment.job.jobId}</span>
                  </Field>
                  <Field label="Job completed">{formatDateTime(payment.job.completedAt)}</Field>
                  <Field label="Inventory item">
                    {payment.job.inventoryItemId ? (
                      <Link to={`/processing/inventory/${payment.job.inventoryItemId}`} onClick={onClose} className="font-semibold text-mint-700 hover:underline">
                        Open item
                      </Link>
                    ) : (
                      'Not found'
                    )}
                  </Field>
                </dl>
              ) : payment.receipt ? (
                <dl className="grid gap-3 sm:grid-cols-3">
                  <Field label="Receipt">
                    <span className="break-all font-mono text-xs">{payment.receipt.receiptId}</span>
                  </Field>
                  <Field label="Received">
                    {formatDateTime(payment.receipt.receivedAt)}
                    <span className="block text-xs text-ink-600">by {payment.receipt.receivedByName ?? 'Not recorded'}</span>
                  </Field>
                  <Field label="Full receipt">
                    <button type="button" onClick={() => setReceiptId(payment.receipt!.receiptId)} className="inline-flex items-center gap-1 font-semibold text-mint-700 hover:underline">
                      <ReceiptText size={14} /> View receipt
                    </button>
                  </Field>
                  {payment.receipt.notes && (
                    <div className="sm:col-span-3">
                      <Field label="Receipt notes">{payment.receipt.notes}</Field>
                    </div>
                  )}
                </dl>
              ) : (
                <p className="text-sm text-ink-600">The source record could not be found.</p>
              )}
            </section>

            {/* Calculation */}
            <section>
              <h4 className="mb-2 font-display text-sm font-bold text-ink-900">How the amount was calculated</h4>

              {!payment.hasSnapshot || !snapshot ? (
                <div className="space-y-3">
                  <Notice tone="warning" title="No saved breakdown">
                    This payment was created before calculation details were recorded, so the rates and components used are not available. The amount above is the original amount — it is not recalculated from today's rates.
                  </Notice>
                  {payment.receipt && payment.receipt.items.length > 0 && (
                    <div className="overflow-x-auto rounded-2xl border border-mint-100 bg-white/60">
                      <table className="w-full min-w-[420px] border-collapse">
                        <thead>
                          <tr className="border-b border-mint-100">
                            <th className={`${tableHeadClass} px-4 py-2`}>Item</th>
                            <th className={`${tableHeadClass} px-4 py-2 text-right`}>Weight</th>
                            <th className={`${tableHeadClass} px-4 py-2`}>Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payment.receipt.items.map((i) => (
                            <tr key={i.id} className="border-b border-mint-50 last:border-0">
                              <td className={`${tableCellClass} font-semibold`}>{i.itemType}</td>
                              <td className={`${tableCellClass} text-right font-mono`}>{formatKg(i.weightKg)}</td>
                              <td className={tableCellClass}>{i.accepted ? 'Accepted (rate not recorded)' : `Rejected — ${i.rejectionReason || 'no reason recorded'}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ) : snapshot.job ? (
                <JobBreakdown job={snapshot.job} total={snapshot.totalAmount} />
              ) : snapshot.extraWaste ? (
                <ExtraWasteBreakdown lines={snapshot.extraWaste.lines} total={snapshot.totalAmount} />
              ) : (
                <Notice tone="warning">The saved breakdown has an unrecognised format.</Notice>
              )}

              {payment.hasSnapshot && (
                <p className="mt-2 text-xs text-ink-600">This is the calculation saved when the payment was created. It is not recalculated from current rates.</p>
              )}
            </section>
          </div>
        ) : null}
      </Modal>

      <MarkPaidModal
        payment={confirmingPay ? payment : null}
        onClose={() => setConfirmingPay(false)}
        onStale={load}
        onDone={(message) => {
          setConfirmingPay(false);
          setNotice(message);
          load();
          onChanged();
        }}
      />
      <ReceiptDetailModal receiptId={receiptId} onClose={() => setReceiptId(null)} />
    </>
  );
};

export default PaymentDetailModal;
