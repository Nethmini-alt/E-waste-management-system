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
import {
  ErrorMessage, GlassCard, LoadingState, PageHeader,
  btnSecondary, inputClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';

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

  if (loading && !plan) return <LoadingState label="Loading plan…" />;
  if (error) return <ErrorMessage message={error} onRetry={load} />;
  if (!plan) return null;

  const canDecide =
    isAdmin && (plan.status === 'PendingApproval' || plan.status === 'RevisionRequested');
  const canMarkExecuted = plan.status === 'Approved';

  return (
    <div>
      <PageHeader
        title="Commercial plan"
        subtitle={plan.commercialPlanId}
        icon={Bot}
        actions={
          <>
            <button onClick={() => navigate(-1)} className="rounded-lg p-2 text-ink-700 hover:bg-mint-50"><ArrowLeft size={18} /></button>
            <PlanStatusPill status={plan.status} />
            <button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          </>
        }
      />

      {/* Awaiting approval banner */}
      {plan.status === 'PendingApproval' && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          ⏳ This plan is awaiting {isAdmin ? 'your' : 'admin'} approval.
          {!isAdmin && ' Only admins can approve or reject.'}
        </div>
      )}

      {/* Summary cards */}
      <div className="mb-5 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <SummaryBox icon={plan.recommendedRoute === 'Export' ? <Globe size={16} /> : <Package size={16} />} label="Route" value={plan.recommendedRoute === 'Export' ? 'Export' : 'Local sale'} />
        <SummaryBox icon={<Truck size={16} />} label="Buyer" value={plan.selectedBuyerName ?? '—'} sub={plan.destinationCountry ?? undefined} />
        <SummaryBox icon={<TrendingUp size={16} />} label="Expected revenue" value={`Rs. ${plan.expectedRevenue.toFixed(2)}`} />
        <SummaryBox icon={<TrendingUp size={16} />} label="Estimated costs" value={`Rs. ${plan.estimatedCosts.toFixed(2)}`} />
        <SummaryBox icon={<CheckCircle2 size={16} />} label="Net value" value={`Rs. ${plan.estimatedNetValue.toFixed(2)}`} sub={`${margin}% margin`} highlight />
      </div>

      {/* Two-column layout */}
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        {/* Left column */}
        <div>
          {/* Materials */}
          <Section title="Materials">
            {materials.length === 0 ? (
              <p className="text-sm text-ink-600">No materials in this plan.</p>
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-mint-100">
                    <th className={`${tableHeadClass} py-2`}>Material</th>
                    <th className={`${tableHeadClass} py-2`}>Quantity</th>
                    {materials.some((m) => m.qualityGrade) && <th className={`${tableHeadClass} py-2`}>Grade</th>}
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m, idx) => (
                    <tr key={idx} className="border-b border-mint-50 last:border-0">
                      <td className={`${tableCellClass} pl-0 font-semibold text-ink-900`}>{m.materialType}</td>
                      <td className={tableCellClass}>{m.quantityKg.toFixed(2)} kg</td>
                      {materials.some((x) => x.qualityGrade) && (
                        <td className={tableCellClass}>{m.qualityGrade ?? '—'}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Reasoning */}
          <Section title="Agent reasoning">
            <div className="rounded-xl bg-sky-50/70 p-3 text-sm leading-relaxed text-ink-800">
              {plan.reasoningSummary}
            </div>
          </Section>

          {/* Risk flags */}
          {riskFlags.length > 0 && (
            <Section title="Risk flags">
              <div className="flex flex-wrap gap-2">
                {riskFlags.map((flag) => (
                  <span key={flag} className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                    <AlertTriangle size={12} /> {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {/* Approval timeline */}
          <Section title="Approval history">
            <PlanTimeline actions={plan.approvalActions} />
          </Section>
        </div>

        {/* Right column — decision panel */}
        <div>
          {(canDecide || canMarkExecuted) && (
            <GlassCard hover={false} className="sticky top-5 !border-2 !border-mint-300">
              <h4 className="mb-3 font-display text-sm font-bold text-ink-900">
                {canDecide ? 'Decision required' : 'Next step'}
              </h4>

              {canDecide && (
                <>
                  <label className="mb-1.5 block text-xs font-bold text-ink-700">
                    Comments {plan.status === 'PendingApproval' && '(required for reject/revision)'}
                  </label>
                  <textarea
                    value={decisionComments}
                    onChange={(e) => setDecisionComments(e.target.value)}
                    rows={4}
                    placeholder="Explain your decision…"
                    className={`${inputClass} mb-3`}
                  />

                  <button onClick={() => handleDecide('Approved')} disabled={submitting} className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-mint-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-mint-500/30 disabled:opacity-60">
                    <CheckCircle2 size={16} /> Approve plan
                  </button>
                  <button onClick={() => handleDecide('RevisionRequested')} disabled={submitting} className="mb-2 flex w-full items-center justify-center gap-2 rounded-full bg-amber-500 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-amber-500/30 disabled:opacity-60">
                    <MessageSquare size={16} /> Request revision
                  </button>
                  <button onClick={() => handleDecide('Rejected')} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-red-500/20 disabled:opacity-60">
                    <XCircle size={16} /> Reject plan
                  </button>
                </>
              )}

              {canMarkExecuted && (
                <>
                  <p className="mt-0 mb-3 text-sm text-ink-600">
                    Plan approved. Create the actual sales/export order, then mark this plan as executed.
                  </p>
                  <button onClick={handleMarkExecuted} disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-mint-600 px-4 py-2.5 text-sm font-bold text-white shadow-md shadow-mint-500/30 disabled:opacity-60">
                    <Send size={16} /> Mark as executed
                  </button>
                </>
              )}
            </GlassCard>
          )}

          {!canDecide && !canMarkExecuted && (
            <GlassCard hover={false} className="text-center text-sm text-ink-600">
              {plan.status === 'Approved' && '✅ Approved — waiting to be executed.'}
              {plan.status === 'Rejected' && '❌ Rejected — no further action.'}
              {plan.status === 'RevisionRequested' && '🔁 Revision requested — awaiting new plan from agent.'}
              {plan.status === 'Executed' && '✔️ Executed — order has been created.'}
            </GlassCard>
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
  highlight?: boolean;
}> = ({ icon, label, value, sub, highlight }) => (
  <GlassCard hover={false} className="p-3.5">
    <div className={`mb-1 flex items-center gap-1.5 ${highlight ? 'text-mint-700' : 'text-sky-700'}`}>
      {icon}
      <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
    </div>
    <div className={`text-base font-bold ${highlight ? 'text-mint-700' : 'text-ink-900'}`}>{value}</div>
    {sub && <div className="mt-0.5 text-[11px] text-ink-600">{sub}</div>}
  </GlassCard>
);

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-5">
    <h4 className="mb-2 font-display text-sm font-bold text-ink-900">{title}</h4>
    <GlassCard hover={false}>{children}</GlassCard>
  </div>
);

export default PlanDetailPage;
