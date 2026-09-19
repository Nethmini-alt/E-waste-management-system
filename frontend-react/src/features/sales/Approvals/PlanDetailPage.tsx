/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-hooks/preserve-manual-memoization */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Bot, TrendingUp, AlertTriangle, CheckCircle2, XCircle,
  MessageSquare, Send, RefreshCw, Truck, Package, Globe,
} from 'lucide-react';
import { planApi } from './planApi';
import type { CommercialPlan, PlanMaterial } from './types';
import PlanStatusPill from './PlanStatusPill';
import PlanTimeline from './PlanTimeline';
import { useAuth } from '../../auth/AuthContext';

const PlanDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [plan, setPlan] = useState<CommercialPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Decision panel state
  const [decisionComments, setDecisionComments] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setPlan(await planApi.get(id));
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load plan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const materials = useMemo<PlanMaterial[]>(() => {
    if (!plan?.materialsJson) return [];
    try {
      const parsed = JSON.parse(plan.materialsJson);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [plan?.materialsJson]);

  const riskFlags = useMemo<string[]>(() => {
    if (!plan?.riskFlags) return [];
    try {
      const parsed = JSON.parse(plan.riskFlags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [plan?.riskFlags]);

  const margin = plan && plan.expectedRevenue > 0
    ? ((plan.estimatedNetValue / plan.expectedRevenue) * 100).toFixed(1)
    : '0';

  const handleDecide = async (decision: 'Approved' | 'Rejected' | 'RevisionRequested') => {
    if (!plan) return;

    if (decision !== 'Approved' && !decisionComments.trim()) {
      alert('Comments are required when rejecting or requesting a revision.');
      return;
    }

    const confirmMsg =
      decision === 'Approved'
        ? 'Approve this plan? Staff will then create the actual order.'
        : decision === 'Rejected'
        ? 'Reject this plan? This cannot be undone.'
        : 'Request a revision? The agent will need to submit a new plan.';

    if (!confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const updated = await planApi.decide(plan.commercialPlanId, {
        decision,
        comments: decisionComments.trim() || undefined,
      });
      setPlan(updated);
      setDecisionComments('');
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to submit decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkExecuted = async () => {
    if (!plan) return;
    if (!confirm('Mark this plan as Executed? Do this after creating the actual sales/export order.')) return;
    setSubmitting(true);
    try {
      const updated = await planApi.markExecuted(plan.commercialPlanId);
      setPlan(updated);
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to mark executed.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p>Loading plan…</p>;
  if (error) return <div style={errorBox}>{error}</div>;
  if (!plan) return null;

  const canDecide =
    isAdmin && (plan.status === 'PendingApproval' || plan.status === 'RevisionRequested');
  const canMarkExecuted = plan.status === 'Approved';

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={iconBtn}><ArrowLeft size={20} /></button>
          <div>
            <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Bot size={22} /> Commercial Plan
            </h2>
            <div style={{ fontSize: 12, color: '#666', fontFamily: 'monospace', marginTop: 2 }}>
              {plan.commercialPlanId}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PlanStatusPill status={plan.status} />
          <button onClick={load} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {/* Awaiting approval banner */}
      {plan.status === 'PendingApproval' && (
        <div style={awaitingBanner}>
          ⏳ This plan is awaiting {isAdmin ? 'your' : 'admin'} approval.
          {!isAdmin && ' Only admins can approve or reject.'}
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 15, marginBottom: 20 }}>
        <SummaryBox
          icon={plan.recommendedRoute === 'Export' ? <Globe size={16} /> : <Package size={16} />}
          label="Route"
          value={plan.recommendedRoute === 'Export' ? 'Export' : 'Local Sale'}
        />
        <SummaryBox
          icon={<Truck size={16} />}
          label="Buyer"
          value={plan.selectedBuyerName ?? '—'}
          sub={plan.destinationCountry ?? undefined}
        />
        <SummaryBox
          icon={<TrendingUp size={16} />}
          label="Expected Revenue"
          value={`Rs. ${plan.expectedRevenue.toFixed(2)}`}
        />
        <SummaryBox
          icon={<TrendingUp size={16} />}
          label="Estimated Costs"
          value={`Rs. ${plan.estimatedCosts.toFixed(2)}`}
        />
        <SummaryBox
          icon={<CheckCircle2 size={16} />}
          label="Net Value"
          value={`Rs. ${plan.estimatedNetValue.toFixed(2)}`}
          sub={`${margin}% margin`}
          highlight="#2e7d32"
        />
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Left column */}
        <div>
          {/* Materials */}
          <Section title="Materials">
            {materials.length === 0 ? (
              <p style={{ color: '#888', fontSize: 13 }}>No materials in this plan.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                    <th style={th}>Material</th>
                    <th style={th}>Quantity</th>
                    {materials.some((m) => m.qualityGrade) && <th style={th}>Grade</th>}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid #f0f0f0' }}>
                      <td style={{ ...td, fontWeight: 'bold' }}>{m.materialType}</td>
                      <td style={td}>{m.quantityKg.toFixed(2)} kg</td>
                      {materials.some((x) => x.qualityGrade) && (
                        <td style={td}>{m.qualityGrade ?? '—'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Reasoning */}
          <Section title="Agent Reasoning">
            <div style={{ padding: 12, background: '#f5f9ff', borderRadius: 6, fontSize: 13, lineHeight: 1.6 }}>
              {plan.reasoningSummary}
            </div>
          </Section>

          {/* Risk flags */}
          {riskFlags.length > 0 && (
            <Section title="Risk Flags">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {riskFlags.map((flag) => (
                  <span key={flag} style={riskBadge}>
                    <AlertTriangle size={12} /> {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Approval timeline */}
          <Section title="Approval History">
            <PlanTimeline actions={plan.approvalActions} />
          </Section>
        </div>

        {/* Right column — decision panel */}
        <div>
          {(canDecide || canMarkExecuted) && (
            <div style={decisionPanel}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: 15 }}>
                {canDecide ? 'Decision Required' : 'Next Step'}
              </h4>

              {canDecide && (
                <>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 'bold', marginBottom: 6 }}>
                    Comments {plan.status === 'PendingApproval' && '(required for reject/revision)'}
                  </label>
                  <textarea
                    value={decisionComments}
                    onChange={(e) => setDecisionComments(e.target.value)}
                    rows={4}
                    placeholder="Explain your decision…"
                    style={{ ...input, marginBottom: 12 }}
                  />

                  <button
                    onClick={() => handleDecide('Approved')}
                    disabled={submitting}
                    style={{ ...btnApprove, width: '100%', justifyContent: 'center', marginBottom: 8 }}
                  >
                    <CheckCircle2 size={16} /> Approve Plan
                  </button>

                  <button
                    onClick={() => handleDecide('RevisionRequested')}
                    disabled={submitting}
                    style={{ ...btnRevision, width: '100%', justifyContent: 'center', marginBottom: 8 }}
                  >
                    <MessageSquare size={16} /> Request Revision
                  </button>

                  <button
                    onClick={() => handleDecide('Rejected')}
                    disabled={submitting}
                    style={{ ...btnReject, width: '100%', justifyContent: 'center' }}
                  >
                    <XCircle size={16} /> Reject Plan
                  </button>
                </>
              )}

              {canMarkExecuted && (
                <>
                  <p style={{ fontSize: 13, color: '#666', marginTop: 0 }}>
                    Plan approved. Create the actual sales/export order, then mark this plan as executed.
                  </p>
                  <button
                    onClick={handleMarkExecuted}
                    disabled={submitting}
                    style={{ ...btnApprove, width: '100%', justifyContent: 'center' }}
                  >
                    <Send size={16} /> Mark as Executed
                  </button>
                </>
              )}
            </div>
          )}

          {!canDecide && !canMarkExecuted && (
            <div style={lockedPanel}>
              {plan.status === 'Approved' && '✅ Approved — waiting to be executed.'}
              {plan.status === 'Rejected' && '❌ Rejected — no further action.'}
              {plan.status === 'RevisionRequested' && '🔁 Revision requested — awaiting new plan from agent.'}
              {plan.status === 'Executed' && '✔️ Executed — order has been created.'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SummaryBox: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  highlight?: string;
}> = ({ icon, label, value, sub, highlight }) => (
  <div style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid #eee' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: highlight ?? '#1565c0', marginBottom: 4 }}>
      {icon}
      <span style={{ fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: 16, fontWeight: 'bold', color: highlight ?? '#222' }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{sub}</div>}
  </div>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ marginBottom: 20 }}>
    <h4 style={{ margin: '0 0 8px 0', fontSize: 14, color: '#333' }}>{title}</h4>
    <div style={{ background: '#fff', padding: 14, borderRadius: 8, border: '1px solid #eee' }}>
      {children}
    </div>
  </div>
);

// ---------- Styles ----------
const th: React.CSSProperties = { padding: 8, fontSize: 12, fontWeight: 'bold', color: '#666' };
const td: React.CSSProperties = { padding: 8 };
const input: React.CSSProperties = {
  width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
};
const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};
const btnApprove: React.CSSProperties = {
  background: '#2e7d32', color: '#fff', border: 'none', padding: '10px 14px',
  borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13,
  display: 'flex', alignItems: 'center', gap: 6,
};
const btnReject: React.CSSProperties = {
  background: '#c62828', color: '#fff', border: 'none', padding: '10px 14px',
  borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13,
  display: 'flex', alignItems: 'center', gap: 6,
};
const btnRevision: React.CSSProperties = {
  background: '#e65100', color: '#fff', border: 'none', padding: '10px 14px',
  borderRadius: 6, cursor: 'pointer', fontWeight: 'bold', fontSize: 13,
  display: 'flex', alignItems: 'center', gap: 6,
};
const awaitingBanner: React.CSSProperties = {
  marginBottom: 15, padding: 12, background: '#fff8e1', color: '#f57f17',
  borderRadius: 6, fontWeight: 'bold', fontSize: 13,
};
const errorBox: React.CSSProperties = { padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6 };
const riskBadge: React.CSSProperties = {
  background: '#fff3e0', color: '#e65100', padding: '4px 10px', borderRadius: 4,
  fontSize: 12, fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: 4,
};
const decisionPanel: React.CSSProperties = {
  background: '#fff', padding: 16, borderRadius: 10, border: '2px solid #1565c0',
  position: 'sticky', top: 20,
};
const lockedPanel: React.CSSProperties = {
  background: '#fafafa', padding: 16, borderRadius: 10, border: '1px solid #eee',
  fontSize: 13, color: '#666', textAlign: 'center',
};

export default PlanDetailPage;