/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Tag, Package, DollarSign, RefreshCw, ArrowRight,
} from 'lucide-react';
import { dashboardApi } from './dashboardApi';
import type { Buyer } from '../Buyers/types';
import type { MaterialPricing } from '../Pricing/types';
import type { RecoveredMaterial } from '../Materials/types';
import { revenueApi } from '../Revenue/revenueApi';
import type { RevenueSummary } from '../Revenue/types';
import {
  ErrorMessage, GlassCard, LoadingState, PageHeader,
  btnSecondary, tableCellClass, tableHeadClass,
} from '../../../components/ui';

interface DashboardData {
  buyers: Buyer[];
  pricing: MaterialPricing[];
  availableMaterials: RecoveredMaterial[];
  revenueSummary: RevenueSummary;
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [buyers, pricing, availableMaterials, revenueSummary] = await Promise.all([
        dashboardApi.buyers(),
        dashboardApi.pricing(),
        dashboardApi.availableMaterials(),
        revenueApi.summary(),
      ]);
      setData({ buyers, pricing, availableMaterials, revenueSummary });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { title?: string } } };
      setError(err?.response?.data?.title ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const stats = data
    ? {
        totalBuyers: data.buyers.length,
        activeBuyers: data.buyers.filter((b) => b.status === 'Active').length,
        approvedPrices: data.pricing.filter((p) => p.isLive).length,
        sellableTonnes:
          data.availableMaterials.reduce((sum, m) => sum + m.quantityKg, 0) / 1000,
      }
    : null;

  const recentPricing = data?.pricing.slice(0, 5) ?? [];

  return (
    <div>
      <PageHeader
        title="Commercial dashboard"
        subtitle="Buyers, pricing, sellable materials and revenue at a glance."
        icon={DollarSign}
        actions={<button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />

      {loading && !data && <LoadingState label="Loading dashboard…" />}
      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      {!loading && !error && stats && data && (
        <>
          {/* Stat cards */}
          <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <StatCard icon={<Users size={20} />} label="Buyers" value={stats.totalBuyers} sub={`${stats.activeBuyers} active`} tone="text-sky-700" onClick={() => navigate('/buyers')} />
            <StatCard icon={<Tag size={20} />} label="Approved prices" value={stats.approvedPrices} sub={`${data.pricing.length} total rows`} tone="text-mint-700" onClick={() => navigate('/pricing')} />
            <StatCard icon={<Package size={20} />} label="Sellable materials" value={stats.sellableTonnes.toFixed(2)} sub={`${data.availableMaterials.length} batches (tonnes)`} tone="text-amber-700" onClick={() => navigate('/materials')} />
            <StatCard
              icon={<DollarSign size={20} />}
              label="Revenue"
              value={`Rs. ${data.revenueSummary.totalRevenue.toLocaleString()}`}
              sub={`${data.revenueSummary.transactionCount} transactions · Local Rs. ${data.revenueSummary.localSaleRevenue.toLocaleString()} · Export Rs. ${data.revenueSummary.exportRevenue.toLocaleString()}`}
              tone="text-violet-700"
              onClick={() => navigate('/revenue')}
            />
          </div>

          {/* Available materials */}
          <Section title="Available recovered materials" actionLabel="View all" onAction={() => navigate('/materials')}>
            {data.availableMaterials.length === 0 ? (
              <EmptyRow message="No sellable materials right now." />
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-mint-100">
                    <th className={`${tableHeadClass} px-4 py-2.5`}>Material</th>
                    <th className={`${tableHeadClass} px-4 py-2.5`}>Quantity (kg)</th>
                    <th className={`${tableHeadClass} px-4 py-2.5`}>Grade</th>
                    <th className={`${tableHeadClass} px-4 py-2.5`}>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {data.availableMaterials.slice(0, 5).map((m) => (
                    <tr key={m.recoveredMaterialId} className="border-t border-mint-50">
                      <td className={`${tableCellClass} font-semibold text-ink-900`}>{m.materialType}</td>
                      <td className={tableCellClass}>{m.quantityKg.toFixed(2)}</td>
                      <td className={tableCellClass}>{m.qualityGrade}</td>
                      <td className={`${tableCellClass} text-ink-600`}>{new Date(m.availableAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Recent pricing */}
          <Section title="Recent pricing" actionLabel="Manage" onAction={() => navigate('/pricing')}>
            {recentPricing.length === 0 ? (
              <EmptyRow message="No pricing rows yet." />
            ) : (
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-mint-100">
                    <th className={`${tableHeadClass} px-4 py-2.5`}>Material</th>
                    <th className={`${tableHeadClass} px-4 py-2.5`}>Price / kg</th>
                    <th className={`${tableHeadClass} px-4 py-2.5`}>Effective</th>
                    <th className={`${tableHeadClass} px-4 py-2.5`}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPricing.map((p) => (
                    <tr key={p.pricingId} className="border-t border-mint-50">
                      <td className={`${tableCellClass} font-semibold text-ink-900`}>{p.materialType}</td>
                      <td className={tableCellClass}>Rs. {p.pricePerKg.toFixed(2)}</td>
                      <td className={tableCellClass}>{p.effectiveDate}</td>
                      <td className={tableCellClass}>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusPillClass(p.status)}`}>{p.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </>
      )}
    </div>
  );
};

// ---------- Helpers ----------
const statusPillClass = (status: string): string => {
  switch (status) {
    case 'Approved': return 'bg-mint-100 text-mint-800';
    case 'Draft': return 'bg-amber-100 text-amber-800';
    default: return 'bg-ink-100 text-ink-700';
  }
};

// ---------- Sub-components ----------
const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  tone: string;
  onClick?: () => void;
}> = ({ icon, label, value, sub, tone, onClick }) => (
  <GlassCard onClick={onClick} className="p-5" hover={!!onClick}>
    <div className={`mb-1.5 flex items-center gap-2 ${tone}`}>
      {icon}
      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
    </div>
    <div className="font-display text-[28px] font-bold text-ink-900">{value}</div>
    <div className="mt-1 text-xs text-ink-600">{sub}</div>
  </GlassCard>
);

const Section: React.FC<{
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
}> = ({ title, actionLabel, onAction, children }) => (
  <div className="mb-6">
    <div className="mb-2.5 flex items-center justify-between">
      <h3 className="font-display text-base font-bold text-ink-900">{title}</h3>
      {actionLabel && onAction && (
        <button onClick={onAction} className="flex items-center gap-1 text-sm font-bold text-mint-700 hover:underline">
          {actionLabel} <ArrowRight size={14} />
        </button>
      )}
    </div>
    <GlassCard hover={false} padded={false} className="overflow-hidden">
      {children}
    </GlassCard>
  </div>
);

const EmptyRow: React.FC<{ message: string }> = ({ message }) => (
  <div className="px-6 py-8 text-center text-sm text-ink-600">{message}</div>
);

export default DashboardPage;
