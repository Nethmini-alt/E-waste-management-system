/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Search, RefreshCw, Eye, Filter,Sparkles } from 'lucide-react';
import { planApi } from './planApi';
import type { CommercialPlan } from './types';
import PlanStatusPill from './PlanStatusPill';
import { useAuth } from '../../auth/AuthContext';
import GeneratePlanModal from './GeneratePlanModal';

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

  const handleGenerate = async (goal: any) => {
  setGenerating(true);
  try {
    const plan = await planApi.generate(goal);
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={22} /> Commercial Plans
          </h2>
          <p style={{ color: '#666', marginTop: 4 }}>
            AI-generated recovery plans awaiting or having received human approval
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnSecondary} disabled={generating}>
            <RefreshCw size={14} /> Refresh
          </button>
          {hasRole('admin') && (
            <button onClick={() => setGenerateOpen(true)} style={btnGenerate}         disabled={generating}>
              <Sparkles size={14} /> Generate AI Plan
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
        <div style={{ ...searchBox, flex: 1, minWidth: 220 }}>
          <Search size={16} color="#888" />
          <input
            placeholder="Search plan ID, buyer, or summary…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Filter size={14} color="#555" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={selectStyle}>
            <option value="All">All Statuses</option>
            <option value="PendingApproval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="RevisionRequested">Revision Requested</option>
            <option value="Executed">Executed</option>
          </select>
        </div>
        <select value={routeFilter} onChange={(e) => setRouteFilter(e.target.value as any)} style={selectStyle}>
          <option value="All">All Routes</option>
          <option value="LocalSale">Local Sale</option>
          <option value="Export">Export</option>
        </select>
      </div>

      {loading && <p>Loading plans…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={emptyBox}>
          <Bot size={40} color="#bbb" />
          <p>
            {plans.length === 0
              ? 'No commercial plans yet. The AI agent will submit plans for approval.'
              : 'No plans match your filters.'}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={th}>Plan</th>
              <th style={th}>Route</th>
              <th style={th}>Buyer / Destination</th>
              <th style={{ ...th, textAlign: 'right' }}>Net Value</th>
              <th style={th}>Status</th>
              <th style={th}>Created</th>
              <th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.commercialPlanId} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                  {p.commercialPlanId.slice(0, 8)}…
                </td>
                <td style={td}>
                  <span
                    style={{
                      fontSize: 12, padding: '3px 8px', borderRadius: 4, fontWeight: 'bold',
                      background: p.recommendedRoute === 'Export' ? '#f3e5f5' : '#e3f2fd',
                      color: p.recommendedRoute === 'Export' ? '#6a1b9a' : '#1565c0',
                    }}
                  >
                    {p.recommendedRoute === 'LocalSale' ? 'Local' : 'Export'}
                  </span>
                </td>
                <td style={td}>
                  {p.selectedBuyerName ?? '—'}
                  {p.destinationCountry && (
                    <span style={{ color: '#666', fontSize: 12 }}> · {p.destinationCountry}</span>
                  )}
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>
                  Rs. {p.estimatedNetValue.toFixed(2)}
                </td>
                <td style={td}><PlanStatusPill status={p.status} /></td>
                <td style={{ ...td, fontSize: 12, color: '#666' }}>
                  {new Date(p.createdAt).toLocaleDateString()}
                </td>
                <td style={td}>
                  <button
                    onClick={() => navigate(`/plans/${p.commercialPlanId}`)}
                    style={iconBtn}
                    title="View"
                  >
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <GeneratePlanModal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onSubmit={handleGenerate}
      />
    </div>
  );
};

const th: React.CSSProperties = { padding: 10, fontSize: 13, fontWeight: 'bold' };
const td: React.CSSProperties = { padding: 10, fontSize: 14 };
const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};
const searchBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '0 10px',
};
const searchInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', padding: 8 };
const selectStyle: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #ccc' };
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, marginRight: 4,
};
const errorBox: React.CSSProperties = { padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6 };
const emptyBox: React.CSSProperties = {
  padding: 40, background: '#fff', borderRadius: 8, textAlign: 'center', color: '#888',
  border: '1px dashed #ccc',
};
const btnGenerate: React.CSSProperties = {
  background: 'linear-gradient(135deg, #6a1b9a 0%, #1565c0 100%)',
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontWeight: 'bold',
  fontSize: 13,
};

export default PlansListPage;