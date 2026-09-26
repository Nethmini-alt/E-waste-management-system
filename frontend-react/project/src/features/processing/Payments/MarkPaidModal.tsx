import React, { useEffect, useState } from 'react';
import { paymentApi } from './paymentApi';
import type { MarkPaidTarget } from './types';
import { PAYMENT_SOURCE_TYPE_LABELS } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, formatMoney, shortId } from '../utils/format';
import { ErrorMessage, Modal, Notice, btnPrimary, btnSecondary } from '../components';

interface MarkPaidModalProps {
  payment: MarkPaidTarget | null;
  onClose: () => void;
  onDone: (message: string) => void;
  /** Called when the API says the payment was already paid, so the list can refresh. */
  onStale: () => void;
}

const MarkPaidModal: React.FC<MarkPaidModalProps> = ({ payment, onClose, onDone, onStale }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
  }, [payment]);

  if (!payment) return null;

  const collector = payment.collectorName ?? `Collector ${shortId(payment.collectorId)}`;

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await paymentApi.markPaid(payment.id);
      onDone(`${formatMoney(payment.amount)} marked as paid to ${collector}.`);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to mark the payment as paid.'));
      onStale();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Mark payment as paid"
      subtitle={`${PAYMENT_SOURCE_TYPE_LABELS[payment.sourceType]} · raised ${formatDateTime(payment.createdAt)}`}
      size="sm"
      busy={submitting}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={confirm} disabled={submitting}>
            {submitting ? 'Saving…' : 'Confirm paid'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-2xl bg-white/60 p-4 text-center">
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Amount</p>
          <p className="font-display text-2xl font-bold text-ink-900">{formatMoney(payment.amount)}</p>
          <p className="mt-1 text-sm text-ink-800">{collector}</p>
          {payment.collectorVehicleType && <p className="text-xs text-ink-600">{payment.collectorVehicleType}</p>}
        </div>
        <Notice tone="warning">Only confirm once the money has actually been handed over. A payment cannot be marked paid twice, and this cannot be undone here.</Notice>
        {error && <ErrorMessage message={error} />}
      </div>
    </Modal>
  );
};

export default MarkPaidModal;
