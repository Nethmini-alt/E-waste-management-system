import React from 'react';
import {
  Send, MessageSquare, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import type { ApprovalAction } from './types';

const ICONS: Record<ApprovalAction['actionType'], React.ReactNode> = {
  Submitted: <Send size={14} />,
  RevisionRequested: <MessageSquare size={14} />,
  Approved: <CheckCircle2 size={14} />,
  Rejected: <XCircle size={14} />,
};

const COLORS: Record<ApprovalAction['actionType'], string> = {
  Submitted: '#1565c0',
  RevisionRequested: '#e65100',
  Approved: '#2e7d32',
  Rejected: '#c62828',
};

const LABELS: Record<ApprovalAction['actionType'], string> = {
  Submitted: 'Submitted',
  RevisionRequested: 'Revision Requested',
  Approved: 'Approved',
  Rejected: 'Rejected',
};

const PlanTimeline: React.FC<{ actions: ApprovalAction[] }> = ({ actions }) => {
  if (actions.length === 0) {
    return <p style={{ color: '#888', fontSize: 13 }}>No actions recorded yet.</p>;
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      {/* vertical line */}
      <div
        style={{
          position: 'absolute',
          left: 6,
          top: 6,
          bottom: 6,
          width: 2,
          background: '#e0e0e0',
        }}
      />
      {actions.map((a) => (
        <div key={a.approvalActionId} style={{ position: 'relative', marginBottom: 16 }}>
          <div
            style={{
              position: 'absolute',
              left: -20,
              top: 2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: COLORS[a.actionType],
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
            }}
          >
            {ICONS[a.actionType]}
          </div>

          <div style={{ fontSize: 13 }}>
            <div style={{ fontWeight: 'bold', color: COLORS[a.actionType] }}>
              {LABELS[a.actionType]}
            </div>
            <div style={{ color: '#666', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Clock size={11} />
              {new Date(a.performedAt).toLocaleString()} · by {a.performedByName || 'Unknown'}
            </div>
            {a.comments && (
              <div
                style={{
                  marginTop: 4,
                  padding: 8,
                  background: '#fafafa',
                  borderRadius: 4,
                  borderLeft: `2px solid ${COLORS[a.actionType]}`,
                  fontSize: 12,
                  color: '#333',
                }}
              >
                {a.comments}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default PlanTimeline;