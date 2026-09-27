/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bot, Search, RefreshCw, Eye, Filter, Sparkles,
} from 'lucide-react';

import { planApi } from './planApi';
import type { CommercialPlan } from './types';
import type { CommercialPlanGoal } from './planApi';

import PlanStatusPill from './PlanStatusPill';
import { useAuth } from '../../auth/AuthContext';
import GeneratePlanModal from './GeneratePlanModal';
import {
  EmptyState, ErrorMessage, GlassCard, PageHeader,
  btnSecondary, inputClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';

const PlansListPage: React.FC = () => {
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | CommercialPlan['status']>('All');
  const [routeFilter, setRouteFilter] = useState<'All' | 'LocalSale' | 'Export'>('All');

  const [generating, setGenerating] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);

  // Load plans
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await planApi.list());
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Filter plans
  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return plans.filter((p) => {
      const matchesSearch =
        p.commercialPlanId.toLowerCase().includes(q) ||
        (p.selectedBuyerName ?? '').toLowerCase().includes(q) ||
        p.reasoningSummary.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      const matchesRoute = routeFilter === 'All' || p.recommendedRoute === routeFilter;
      return matchesSearch && matchesStatus && matchesRoute;
    });
  }, [plans, search, statusFilter, routeFilter]);

  // Generate AI commercial plan
  const handleGenerate = async (goal: CommercialPlanGoal) => {
    setGenerating(true);
    try {
      const plan = await planApi.generate(goal);
      setGenerateOpen(false);
      navigate(`/plans/${plan.commercialPlanId}`);
    } catch (e: any) {
      const detail = e?.response?.data?.detail ?? e?.response?.data?.title;
      const hint = e?.response?.data?.hint;
      alert(`${detail ?? 'Failed to run agent.'}${hint ? `\n\n${hint}` : ''}`);
      throw e;
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Commercial plans"
        subtitle="AI-generated recovery plans awaiting or having received human approval."
        icon={Bot}
        actions={
          <>
            <button onClick={load} className={btnSecondary} disabled={generating}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            {hasRole('admin') && (
              <button
                onClick={() => setGenerateOpen(true)}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-violet-600 to-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/30 disabled:opacity-60"
              >
                <Sparkles size={14} /> Generate AI plan
              </button>
            )}
          </>
        }
      />

      <GlassCard hover={false} className="mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
            <input
              placeholder="Search plan ID, buyer, or summary…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-ink-600" />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={`${inputClass} !w-auto`}>
              <option value="All">All statuses</option>
              <option value="PendingApproval">Pending approval</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
              <option value="RevisionRequested">Revision requested</option>
              <option value="Executed">Executed</option>
            </select>
          </div>
          <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value as any)} className={`${inputClass} !w-auto`}>
            <option value="All">All routes</option>
            <option value="LocalSale">Local sale</option>
            <option value="Export">Export</option>
          </select>
        </div>
      </GlassCard>

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !plans.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-600">Loading plans…</p>
        ) : !error && filtered.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={plans.length === 0 ? 'No commercial plans yet' : 'No plans match your filters'}
            description={plans.length === 0 ? 'The AI agent will submit plans for approval.' : undefined}
          />
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Plan</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Route</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Buyer / destination</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Net value</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Created</th>
                  <th className={`${tableHeadClass} px-4 py-3`}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.commercialPlanId} className="border-b border-mint-50 last:border-0">
                    <td className={`${tableCellClass} font-mono text-xs`}>{p.commercialPlanId.slice(0, 8)}…</td>
                    <td className={tableCellClass}>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${p.recommendedRoute === 'Export' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>
                        {p.recommendedRoute === 'LocalSale' ? 'Local' : 'Export'}
                      </span>
                    </td>
                    <td className={tableCellClass}>
                      {p.selectedBuyerName ?? '—'}
                      {p.destinationCountry && <span className="text-xs text-ink-600"> · {p.destinationCountry}</span>}
                    </td>
                    <td className={`${tableCellClass} text-right font-bold`}>Rs. {p.estimatedNetValue.toFixed(2)}</td>
                    <td className={tableCellClass}><PlanStatusPill status={p.status} /></td>
                    <td className={`${tableCellClass} text-xs text-ink-600`}>{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className={tableCellClass}>
                      <button onClick={() => navigate(`/plans/${p.commercialPlanId}`)} className="rounded-lg p-1.5 text-ink-700 hover:bg-mint-50" title="View">
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </GlassCard>

      <GeneratePlanModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={handleGenerate}
      />
    </div>
  );
};

export default PlansListPage;
