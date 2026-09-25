import React from 'react';
import {
  INVENTORY_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  isInventoryStatus,
  isPaymentStatus,
} from '../processingEnums';

// Full literal class names so Tailwind's scanner keeps them.
const STYLES: Record<string, { pill: string; dot: string }> = {
  Received: { pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  Sorting: { pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  Dismantling: { pill: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' },
  Classified: { pill: 'bg-mint-100 text-mint-800', dot: 'bg-mint-500' },
  ReadyForSale: { pill: 'bg-mint-600 text-white', dot: 'bg-white' },
  ExportOnly: { pill: 'bg-violet-100 text-violet-800', dot: 'bg-violet-500' },
  OnHold: { pill: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  // Payments
  Pending: { pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  Paid: { pill: 'bg-mint-100 text-mint-800', dot: 'bg-mint-500' },
  // Intake workflow (Agentic Review)
  Planning: { pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  Analyzing: { pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  Validating: { pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  Matching: { pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  Finalizing: { pill: 'bg-sky-100 text-sky-800', dot: 'bg-sky-500' },
  PendingApproval: { pill: 'bg-amber-100 text-amber-800', dot: 'bg-amber-500' },
  Completed: { pill: 'bg-mint-100 text-mint-800', dot: 'bg-mint-500' },
  Rejected: { pill: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
  Failed: { pill: 'bg-red-100 text-red-800', dot: 'bg-red-500' },
};

const FALLBACK = { pill: 'bg-ink-100 text-ink-800', dot: 'bg-ink-600' };

interface StatusBadgeProps {
  /** An InventoryStatus ("Sorting") or a PaymentStatus ("Pending") exactly as the API returns it. */
  status: string;
  /** Overrides the default label (used for statuses this component has no built-in wording for). */
  label?: string;
  className?: string;
}

const labelFor = (status: string): string => {
  if (isInventoryStatus(status)) return INVENTORY_STATUS_LABELS[status];
  if (isPaymentStatus(status)) return PAYMENT_STATUS_LABELS[status];
  return status;
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, className = '' }) => {
  const style = STYLES[status] ?? FALLBACK;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style.pill} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
      {label ?? labelFor(status)}
    </span>
  );
};

export default StatusBadge;
