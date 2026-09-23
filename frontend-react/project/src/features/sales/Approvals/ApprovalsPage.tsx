/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, RefreshCw, Eye, CheckCircle2, XCircle,
  AlertTriangle, Clock, Bot,
} from 'lucide-react';
import { planApi } from './planApi';
import type { CommercialPlan } from './types';
import PlanStatusPill from './PlanStatusPill';

const ApprovalsPage: React.FC = () => {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickActionId, setQuickActionId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await planApi.list();
      // Show pending + revision-requested plans (both need admin attention)
      setPlans(all.filter((p) => p.status === 'PendingApproval' || p.status === 'RevisionRequested'));
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load approvals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const quickApprove = async (plan: CommercialPlan) => {
    if (!confirm(`Approve plan for ${plan.selectedBuyerName ?? 'this plan'}?`)) return;
    setQuickActionId(plan.commercialPlanId);
    try {
      await planApi.decide(plan.commercialPlanId, {
        decision: 'Approved',
        comments: 'Approved via quick action.',
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to approve.');
    } finally {
      setQuickActionId(null);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckSquare size={22} /> Commercial Approvals
          </h2>
          <p style={{ color: '#666', marginTop: 4 }}>
            AI-generated plans awaiting your decision (human-in-the-loop)
          </p>
        </div>
        <button onClick={load} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
      </div>

      {loading && <p>Loading approvals…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && plans.length === 0 && (
        <div style={emptyBox}>
          <CheckCircle2 size={40} color="#bbb" />
          <p>All clear! No plans awaiting approval.</p>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {plans.map((plan) => {
            const riskCount = (() => {
              try {
                const parsed = JSON.parse(plan.riskFlags ?? '[]');
                return Array.isArray(parsed) ? parsed.length : 0;
              } catch { return 0; }
            })();

            const busy = quickActionId === plan.commercialPlanId;

            return (
              <div key={plan.commercialPlanId} style={approvalCard}>
                {/* Left: main info */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <Bot size={16} color="#1565c0" />
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#666' }}>
                      {plan.commercialPlanId.slice(0, 8)}…
                    </span>
                    <PlanStatusPill status={plan.status} />
                    {riskCount > 0 && (
                      <span style={riskBadge}>
                        <AlertTriangle size={11} /> {riskCount} risk{riskCount > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 20, marginBottom: 8, fontSize: 13 }}>
                    <div>
                      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase' }}>Route</div>
                      <div style={{ fontWeight: 'bold' }}>
                        {plan.recommendedRoute === 'Export' ? '🌍 Export' : '📦 Local Sale'}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase' }}>Buyer</div>
                      <div style={{ fontWeight: 'bold' }}>{plan.selectedBuyerName ?? '—'}</div>
                    </div>
                    {plan.destinationCountry && (
                      <div>
                        <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase' }}>Destination</div>
                        <div style={{ fontWeight: 'bold' }}>{plan.destinationCountry}</div>
                      </div>
                    )}
                    <div>
                      <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase' }}>Net Value</div>
                      <div style={{ fontWeight: 'bold', color: '#2e7d32' }}>
                        Rs. {plan.estimatedNetValue.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div
                    style={{
                      fontSize: 12, color: '#555', fontStyle: 'italic',
                      padding: 8, background: '#f5f9ff', borderRadius: 4,
                      maxHeight: 60, overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    "{plan.reasoningSummary}"
                  </div>

                  <div style={{ fontSize: 11, color: '#999', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clock size={11} />
                    Submitted {new Date(plan.createdAt).toLocaleString()}
                  </div>
                </div>

                {/* Right: actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 160 }}>
                  <button
                    onClick={() => navigate(`/plans/${plan.commercialPlanId}`)}
                    style={btnSecondary}
                  >
                    <Eye size={14} /> Review Details
                  </button>
                  <button
                    onClick={() => quickApprove(plan)}
                    disabled={busy}
                    style={btnApprove}
                  >
                    <CheckCircle2 size={14} /> {busy ? 'Approving…' : 'Quick Approve'}
                  </button>
                  <button
                    onClick={() => navigate(`/plans/${plan.commercialPlanId}`)}
                    style={btnRejectOutline}
                  >
                    <XCircle size={14} /> Reject / Revise
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const approvalCard: React.CSSProperties = {
  display: 'flex', gap: 20, background: '#fff', padding: 16,
  borderRadius: 10, border: '1px solid #eee',
  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
};
const riskBadge: React.CSSProperties = {
  background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: 4,
  fontSize: 11, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 3,
};
const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  fontWeight: 'bold', fontSize: 13,
};
const btnApprove: React.CSSProperties = {
  background: '#2e7d32', color: '#fff', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  fontWeight: 'bold', fontSize: 13,
};
const btnRejectOutline: React.CSSProperties = {
  background: '#fff', color: '#c62828', border: '1px solid #c62828', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
  fontWeight: 'bold', fontSize: 13,
};
const errorBox: React.CSSProperties = { padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6 };
const emptyBox: React.CSSProperties = {
  padding: 40, background: '#fff', borderRadius: 8, textAlign: 'center', color: '#888',
  border: '1px dashed #ccc',
};

export default ApprovalsPage;