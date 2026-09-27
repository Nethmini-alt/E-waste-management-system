import React from 'react';
import { Check, Loader } from 'lucide-react';
import type { SubmissionStatus } from './types';

interface Props {
  status: SubmissionStatus;
  /** CollectionWorkflow.ApprovalRequired — set once Validator or Matcher ever
   * flagged this submission, and kept even after it's resolved. Used to
   * decide whether the Review step belongs in the journey at all. */
  approvalRequired: boolean;
}

const FINAL_SUCCESS: SubmissionStatus[] = ['CollectorAssigned', 'AwaitingCollector', 'Collected', 'Closed'];

/**
 * Submitted → Analyzing → Review (only once it's actually needed) → Scheduled.
 * Only rendered for the normal in-progress/succeeded path — SubmitPage shows
 * Rejected/Failed/Cancelled as a plain reason banner instead, since there's
 * no reliable way to say which step a failure happened at.
 */
export const SubmissionProgress: React.FC<Props> = ({ status, approvalRequired }) => {
  const steps = approvalRequired
    ? ['Submitted', 'Analyzing', 'Review', 'Scheduled']
    : ['Submitted', 'Analyzing', 'Scheduled'];

  const currentIndex = (() => {
    if (status === 'Analyzing') return steps.indexOf('Analyzing');
    if (status === 'AwaitingReview') return steps.indexOf('Review');
    return steps.length - 1; // Scheduling, or a final success status
  })();

  const isDoneAtCurrent = FINAL_SUCCESS.includes(status);

  return (
    <ol style={{ display: 'flex', alignItems: 'center', listStyle: 'none', padding: 0, margin: '15px 0' }} aria-label="Submission progress">
      {steps.map((label, i) => {
        const done = i < currentIndex || (i === currentIndex && isDoneAtCurrent);
        const active = i === currentIndex && !isDoneAtCurrent;
        return (
          <li key={label} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 26, height: 26, borderRadius: '50%', fontSize: 12, fontWeight: 'bold',
                  background: done ? '#2e7d32' : active ? '#e65100' : '#e0e0e0',
                  color: done || active ? '#fff' : '#666',
                }}
              >
                {done ? <Check size={14} /> : active ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : i + 1}
              </span>
              <span style={{ fontSize: 11, whiteSpace: 'nowrap', color: active ? '#e65100' : '#666', fontWeight: active ? 'bold' : 'normal' }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span style={{ flex: 1, height: 2, margin: '0 6px 18px', background: i < currentIndex ? '#2e7d32' : '#e0e0e0' }} />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default SubmissionProgress;
