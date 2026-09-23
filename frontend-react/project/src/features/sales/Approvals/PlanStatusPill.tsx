import React from 'react';
import type { CommercialPlan } from './types';

const CONFIG: Record<CommercialPlan['status'], { bg: string; fg: string; label: string }> = {
  Draft: { bg: '#eceff1', fg: '#546e7a', label: 'Draft' },
  PendingApproval: { bg: '#fff8e1', fg: '#f57f17', label: 'Pending Approval' },
  Approved: { bg: '#e3f2fd', fg: '#1565c0', label: 'Approved' },
  Rejected: { bg: '#ffebee', fg: '#c62828', label: 'Rejected' },
  RevisionRequested: { bg: '#fff3e0', fg: '#e65100', label: 'Revision Requested' },
  Executed: { bg: '#e8f5e9', fg: '#2e7d32', label: 'Executed' },
};

const PlanStatusPill: React.FC<{ status: CommercialPlan['status'] }> = ({ status }) => {
  const c = CONFIG[status];
  return (
    <span
      style={{
        background: c.bg,
        color: c.fg,
        padding: '4px 10px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 'bold',
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
};

export default PlanStatusPill;