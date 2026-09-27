import React, { useEffect, useState } from 'react';
import { ratePolicyApi } from './ratePolicyApi';
import type { RatePolicy } from '../types';
import { LIMITS } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { formatMoney } from '../utils/format';
import { ErrorMessage, Modal, Notice, btnPrimary, btnSecondary, inputClass, labelClass } from '../components';

// rate_per_kg is decimal(10,2) on the backend.
const MAX_RATE = 99_999_999.99;

interface RatePolicyFormModalProps {
  open: boolean;
  /** Null = add a new item type; a policy = revise that active rate. */
  policy: RatePolicy | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

const RatePolicyFormModal: React.FC<RatePolicyFormModalProps> = ({ open, policy, onClose, onDone }) => {
  const revising = policy !== null;
  const [itemType, setItemType] = useState('');
  const [rate, setRate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setItemType('');
      setRate(policy ? String(policy.ratePerKg) : '');
      setSubmitted(false);
      setError(null);
    }
  }, [open, policy]);

  const rateNum = Number(rate);
  const problems: string[] = [];
  if (!revising && !itemType.trim()) problems.push('Enter the item type.');
  if (!revising && itemType.trim().length > LIMITS.itemType) problems.push(`Item type must be ${LIMITS.itemType} characters or fewer.`);
  if (!(rateNum > 0) || rateNum > MAX_RATE) problems.push('Enter a rate per kg greater than 0.');
  else if (!/^\d+(\.\d{1,2})?$/.test(rate.trim())) problems.push('Use at most two decimal places.');
  if (revising && rateNum === policy.ratePerKg) problems.push('The new rate is the same as the current rate.');

  const submit = async () => {
    setSubmitted(true);
    if (problems.length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      if (revising) {
        const saved = await ratePolicyApi.revise(policy.id, rateNum);
        onDone(`${saved.itemType} now pays ${formatMoney(saved.ratePerKg)} per kg. The old rate is kept in the history.`);
      } else {
        const saved = await ratePolicyApi.create(itemType, rateNum);
        onDone(`${saved.itemType} added at ${formatMoney(saved.ratePerKg)} per kg.`);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, revising ? 'Failed to revise the rate.' : 'Failed to add the rate.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={revising ? `Revise rate — ${policy.itemType}` : 'Add rate policy'}
      subtitle={revising ? `Current rate ${formatMoney(policy.ratePerKg)} per kg` : 'A new item type collectors can be paid for'}
      busy={submitting}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={submitting}>
            {submitting ? 'Saving…' : revising ? 'Save new rate' : 'Add rate'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {!revising && (
          <div>
            <label className={labelClass} htmlFor="rp-type">
              Item type
            </label>
            <input
              id="rp-type"
              value={itemType}
              maxLength={LIMITS.itemType}
              onChange={(e) => setItemType(e.target.value)}
              className={inputClass}
              placeholder="e.g. Printer"
            />
          </div>
        )}

        <div>
          <label className={labelClass} htmlFor="rp-rate">
            Rate per kg (Rs.)
          </label>
          <input
            id="rp-rate"
            type="number"
            min="0"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className={inputClass}
          />
        </div>

        <Notice tone="info">
          {revising
            ? 'The current rate is switched off and kept as history; the new rate applies to payments created from now on.'
            : 'The new rate applies to payments created from now on.'}{' '}
          Existing payments never change.
        </Notice>

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
      </div>
    </Modal>
  );
};

export default RatePolicyFormModal;
