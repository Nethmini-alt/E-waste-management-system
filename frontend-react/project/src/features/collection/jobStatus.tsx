import React from 'react';
import type { JobStatus } from './types';

// One place for how each status is named and coloured, so the dashboard,
// job detail and collector pages all speak the same language. Labels are
// written for staff, not copied from the enum.
const STATUS: Record<JobStatus, { label: string; className: string }> = {
  Assigned: { label: 'Waiting for collector', className: 'bg-sky-100 text-sky-800' },
  Accepted: { label: 'Accepted', className: 'bg-mint-100 text-mint-800' },
  InProgress: { label: 'In progress', className: 'bg-mint-200 text-mint-900' },
  Completed: { label: 'Collected', className: 'bg-ink-100 text-ink-800' },
  Cancelled: { label: 'Cancelled', className: 'bg-ink-50 text-ink-600 line-through decoration-ink-600/40' },
  Rejected: { label: 'Rejected', className: 'bg-rose-100 text-rose-800' },
  NoCollectorAvailable: { label: 'No collector found', className: 'bg-amber-100 text-amber-900' },
  PickupLocationUnresolved: { label: 'Address not found', className: 'bg-amber-100 text-amber-900' },
};

export const statusLabel = (s: JobStatus) => STATUS[s]?.label ?? s;

/** Jobs that are stuck until a staff member acts on them. */
export const needsAttention = (s: JobStatus) =>
  s === 'NoCollectorAvailable' || s === 'PickupLocationUnresolved';

/** What's wrong with a stuck job and what staff can do about it. */
export const attentionReason = (s: JobStatus): string | null => {
  if (s === 'PickupLocationUnresolved')
    return "The pickup address couldn't be found on the map. Correct it to start matching.";
  if (s === 'NoCollectorAvailable')
    return 'No available collector could take this pickup. Run matching again or choose a collector.';
  return null;
};

export const JobStatusPill: React.FC<{ status: JobStatus }> = ({ status }) => {
  const c = STATUS[status] ?? { label: status, className: 'bg-ink-100 text-ink-800' };
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${c.className}`}>
      {c.label}
    </span>
  );
};

// ---- small formatting helpers shared by the Collection pages ----

export const formatRoute = (km: number | null, minutes: number | null): string | null => {
  if (km == null && minutes == null) return null;
  const parts: string[] = [];
  if (km != null) parts.push(`${km.toFixed(1)} km`);
  if (minutes != null) parts.push(`${minutes} min`);
  return parts.join(', ');
};

export const timeAgo = (iso: string, now = Date.now()): string => {
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (secs < 60) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
};

export const formatDateTime = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
