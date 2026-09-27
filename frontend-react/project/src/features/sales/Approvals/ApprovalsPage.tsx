/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckSquare, RefreshCw, Eye, CheckCircle2, XCircle,
  AlertTriangle, Clock, Bot, Globe, Package,
} from 'lucide-react';
import { planApi } from './planApi';
import type { CommercialPlan } from './types';
import PlanStatusPill from './PlanStatusPill';
import {
  EmptyState, ErrorMessage, GlassCard, PageHeader,
  btnPrimary, btnSecondary,
} from '../../../components/ui';

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
      <PageHeader
        title="Commercial approvals"
        subtitle="AI-generated plans awaiting your decision (human-in-the-loop)."
        icon={CheckSquare}
        actions={<button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !plans.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-600">Loading approvals…</p>
        ) : !error && plans.length === 0 ? (
          <EmptyState icon={CheckCircle2} title="All clear!" description="No plans awaiting approval." />
        ) : !error ? (
          <div className="divide-y divide-mint-50">
            {plans.map((plan) => {
              const riskCount = (() => {
                try {
                  const parsed = JSON.parse(plan.riskFlags ?? '[]');
                  return Array.isArray(parsed) ? parsed.length : 0;
                } catch { return 0; }
              })();

              const busy = quickActionId === plan.commercialPlanId;

              return (
                <div key={plan.commercialPlanId} className="flex flex-wrap gap-5 p-5">
                  {/* Left: main info */}
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2.5">
                      <Bot size={16} className="text-sky-700" />
                      <span className="font-mono text-xs text-ink-600">{plan.commercialPlanId.slice(0, 8)}…</span>
                      <PlanStatusPill status={plan.status} />
                      {riskCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                          <AlertTriangle size={11} /> {riskCount} risk{riskCount > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    <div className="mb-2 flex flex-wrap gap-5 text-sm">
                      <div>
                        <div className="text-[11px] uppercase text-ink-600">Route</div>
                        <div className="flex items-center gap-1.5 font-semibold text-ink-900">
                          {plan.recommendedRoute === 'Export' ? <Globe size={14} /> : <Package size={14} />}
                          {plan.recommendedRoute === 'Export' ? 'Export' : 'Local sale'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase text-ink-600">Buyer</div>
                        <div className="font-semibold text-ink-900">{plan.selectedBuyerName ?? '—'}</div>
                      </div>
                      {plan.destinationCountry && (
                        <div>
                          <div className="text-[11px] uppercase text-ink-600">Destination</div>
                          <div className="font-semibold text-ink-900">{plan.destinationCountry}</div>
                        </div>
                      )}
                      <div>
                        <div className="text-[11px] uppercase text-ink-600">Net value</div>
                        <div className="font-bold text-mint-700">Rs. {plan.estimatedNetValue.toFixed(2)}</div>
                      </div>
                    </div>

                    <div className="max-h-[60px] overflow-hidden rounded-xl bg-sky-50/70 p-2.5 text-xs italic text-ink-700">
                      &ldquo;{plan.reasoningSummary}&rdquo;
                    </div>

                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-ink-600">
                      <Clock size={11} /> Submitted {new Date(plan.createdAt).toLocaleString()}
                    </div>
                  </div>

                  {/* Right: actions */}
                  <div className="flex min-w-[170px] flex-col gap-2">
                    <button onClick={() => navigate(`/plans/${plan.commercialPlanId}`)} className={btnSecondary}>
                      <Eye size={14} /> Review details
                    </button>
                    <button onClick={() => quickApprove(plan)} disabled={busy} className={btnPrimary}>
                      <CheckCircle2 size={14} /> {busy ? 'Approving…' : 'Quick approve'}
                    </button>
                    <button
                      onClick={() => navigate(`/plans/${plan.commercialPlanId}`)}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-red-300 bg-white/70 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
                    >
                      <XCircle size={14} /> Reject / revise
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
};

export default ApprovalsPage;
