import React from 'react';

export type StatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const PILL: Record<StatusTone, string> = {
  success: 'bg-mint-100 text-mint-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
  info: 'bg-sky-100 text-sky-800',
  neutral: 'bg-ink-100 text-ink-800',
};

const DOT: Record<StatusTone, string> = {
  success: 'bg-mint-500',
  warning: 'bg-amber-500',
  error: 'bg-red-500',
  info: 'bg-sky-500',
  neutral: 'bg-ink-600',
};

interface StatusPillProps {
  label: string;
  tone?: StatusTone;
  className?: string;
}

/** Generic tone-based status pill for customer-facing statuses (submissions, requests, orders). */
export const StatusPill: React.FC<StatusPillProps> = ({ label, tone = 'neutral', className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${PILL[tone]} ${className}`}>
    <span className={`h-1.5 w-1.5 rounded-full ${DOT[tone]}`} />
    {label}
  </span>
);

export default StatusPill;
