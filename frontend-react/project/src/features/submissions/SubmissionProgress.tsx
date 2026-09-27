import React from 'react';
import { Check, Loader2 } from 'lucide-react';
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
    <ol className="my-4 flex items-center" aria-label="Submission progress">
      {steps.map((label, i) => {
        const done = i < currentIndex || (i === currentIndex && isDoneAtCurrent);
        const active = i === currentIndex && !isDoneAtCurrent;
        return (
          <li key={label} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
            <div className="flex flex-col items-center gap-1">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                  done
                    ? 'bg-mint-600 text-white shadow-mint-500/30'
                    : active
                      ? 'bg-amber-500 text-white shadow-amber-500/30'
                      : 'bg-ink-100 text-ink-600'
                }`}
              >
                {done ? <Check size={14} /> : active ? <Loader2 size={13} className="animate-spin" /> : i + 1}
              </span>
              <span className={`whitespace-nowrap text-[11px] ${active ? 'font-bold text-amber-700' : 'text-ink-600'}`}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span className={`mx-1.5 mb-[18px] h-0.5 flex-1 rounded-full ${i < currentIndex ? 'bg-mint-600' : 'bg-ink-100'}`} />
            )}
          </li>
        );
      })}
    </ol>
  );
};

export default SubmissionProgress;
