import React from 'react';
import type { Job, JobHistoryEntry } from './types';
import { formatDateTime, timeAgo } from './jobStatus';

type Tone = 'neutral' | 'good' | 'bad' | 'staff' | 'agent';

interface Step {
  key: string;
  title: string;
  detail?: string | null;
  at?: string | null;
  tone: Tone;
}

const DOT: Record<Tone, string> = {
  neutral: 'bg-sky-500',
  good: 'bg-mint-600',
  bad: 'bg-rose-500',
  staff: 'bg-amber-500',
  agent: 'bg-violet-500',
};

// Assignment rows carry a reason when something other than plain automatic
// matching decided (see JobService): the Matcher agent's recommendation, or
// a staff action. Plain automatic assignments leave it empty.
const assignmentTone = (h: JobHistoryEntry): Tone => {
  if (!h.reason) return 'neutral';
  return h.reason.includes('Matcher') ? 'agent' : 'staff';
};

const buildSteps = (job: Job, history: JobHistoryEntry[]): Step[] => {
  const steps: Step[] = [{ key: 'created', title: 'Job created from approved submission', at: job.createdAt, tone: 'neutral' }];

  for (const h of history) {
    if (h.outcome === 'Assigned') {
      steps.push({
        key: h.historyId,
        title: `Offered to ${h.collectorName}`,
        detail: h.reason ?? 'Chosen by automatic matching',
        at: h.timestamp,
        tone: assignmentTone(h),
      });
    } else if (h.outcome === 'Accepted') {
      steps.push({ key: h.historyId, title: `${h.collectorName} accepted`, at: h.timestamp, tone: 'good' });
    } else {
      steps.push({
        key: h.historyId,
        title: `${h.collectorName} declined`,
        detail: h.reason ? `Reason: ${h.reason}` : 'No reason given',
        at: h.timestamp,
        tone: 'bad',
      });
    }
  }

  // States that aren't in the history table.
  if (job.status === 'PickupLocationUnresolved')
    steps.push({ key: 'unresolved', title: "Address couldn't be located", detail: 'Waiting for staff to correct it', tone: 'staff' });
  if (job.status === 'NoCollectorAvailable')
    steps.push({ key: 'nocollector', title: 'No collector available', detail: 'Waiting for staff to assign one', tone: 'staff' });
  if (job.startedAt)
    steps.push({ key: 'started', title: `${job.collectorName ?? 'Collector'} set off for the pickup`, at: job.startedAt, tone: 'good' });
  if (job.status === 'Completed')
    steps.push({ key: 'completed', title: 'Collected', at: job.completedAt, tone: 'good' });
  if (job.status === 'Cancelled')
    steps.push({ key: 'cancelled', title: 'Cancelled by staff', tone: 'bad' });

  return steps;
};

const JobTimeline: React.FC<{ job: Job; history: JobHistoryEntry[] }> = ({ job, history }) => {
  const steps = buildSteps(job, history);
  return (
    <ol className="relative">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0">
          {/* connector line between dots */}
          {i < steps.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-mint-200" aria-hidden />}
          <span className={`relative mt-1.5 h-[11px] w-[11px] flex-shrink-0 rounded-full ring-4 ring-white/80 ${DOT[s.tone]}`} aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink-900">{s.title}</p>
            {s.detail && <p className="text-sm text-ink-600">{s.detail}</p>}
            {s.at && (
              <p className="text-xs text-ink-600/80" title={formatDateTime(s.at)}>
                {formatDateTime(s.at)} ({timeAgo(s.at)})
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
};

export default JobTimeline;
