/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, RefreshCw, Search, Filter,
} from 'lucide-react';
import { revenueApi } from './revenueApi';
import type { RevenueTransaction, RevenueSummary } from './types';
import {
  EmptyState, ErrorMessage, GlassCard, PageHeader,
  btnSecondary, inputClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';

const RevenuePage: React.FC = () => {
  const [rows, setRows] = useState<RevenueTransaction[]>([]);
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'LocalSale' | 'Export'>('All');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [transactions, summ] = await Promise.all([
        revenueApi.list(),
        revenueApi.summary(),
      ]);
      setRows(transactions);
      setSummary(summ);
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load revenue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((r) => {
      const matchesSearch =
        r.referenceId.toLowerCase().includes(q) ||
        r.recordedByName.toLowerCase().includes(q) ||
        (r.remarks ?? '').toLowerCase().includes(q);
      const matchesType = typeFilter === 'All' || r.transactionType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [rows, search, typeFilter]);

  const filteredTotal = useMemo(
    () => filtered.reduce((sum, r) => sum + r.amount, 0),
    [filtered]
  );

  return (
    <div>
      <PageHeader
        title="Revenue"
        subtitle="Ledger of completed commercial transactions."
        icon={DollarSign}
        actions={<button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      {!loading && !error && summary && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <SummaryCard label="Total revenue" value={summary.totalRevenue} sub={`${summary.transactionCount} transactions`} tone="text-mint-700" />
            <SummaryCard label="Local sales" value={summary.localSaleRevenue} sub={percentOf(summary.localSaleRevenue, summary.totalRevenue)} tone="text-sky-700" />
            <SummaryCard label="Export" value={summary.exportRevenue} sub={percentOf(summary.exportRevenue, summary.totalRevenue)} tone="text-violet-700" />
          </div>

          {/* Monthly breakdown */}
          {summary.monthly.length > 0 && (
            <div className="mb-6">
              <h3 className="mb-2.5 font-display text-base font-bold text-ink-900">Monthly breakdown</h3>
              <GlassCard hover={false} padded={false}>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-mint-100">
                        <th className={`${tableHeadClass} px-4 py-3`}>Month</th>
                        <th className={`${tableHeadClass} px-4 py-3 text-right`}>Transactions</th>
                        <th className={`${tableHeadClass} px-4 py-3 text-right`}>Amount</th>
                        <th className={`${tableHeadClass} px-4 py-3 w-2/5`}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.monthly.map((m) => {
                        const pct = summary.totalRevenue > 0 ? (m.amount / summary.totalRevenue) * 100 : 0;
                        return (
                          <tr key={m.month} className="border-b border-mint-50 last:border-0">
                            <td className={`${tableCellClass} font-semibold text-ink-900`}>{m.month}</td>
                            <td className={`${tableCellClass} text-right`}>{m.count}</td>
                            <td className={`${tableCellClass} text-right font-bold`}>Rs. {m.amount.toFixed(2)}</td>
                            <td className={tableCellClass}>
                              <div className="h-2 overflow-hidden rounded-full bg-mint-50">
                                <div className="h-full rounded-full bg-mint-600" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </GlassCard>
            </div>
          )}

          {/* Transactions list */}
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-base font-bold text-ink-900">Transactions</h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px]">
                <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
                <input
                  placeholder="Search by reference or remarks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`${inputClass} pl-10`}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Filter size={14} className="text-ink-600" />
                <select aria-label="Filter by type" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)} className={`${inputClass} !w-auto`}>
                  <option value="All">All types</option>
                  <option value="LocalSale">Local sale</option>
                  <option value="Export">Export</option>
                </select>
              </div>
            </div>
          </div>

          <GlassCard hover={false} padded={false}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={DollarSign}
                title={rows.length === 0 ? 'No revenue transactions yet' : 'No transactions match your filters'}
                description={rows.length === 0 ? 'Complete a sales or export order to generate one.' : undefined}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-mint-100">
                      <th className={`${tableHeadClass} px-4 py-3`}>Date</th>
                      <th className={`${tableHeadClass} px-4 py-3`}>Type</th>
                      <th className={`${tableHeadClass} px-4 py-3`}>Reference</th>
                      <th className={`${tableHeadClass} px-4 py-3`}>Recorded by</th>
                      <th className={`${tableHeadClass} px-4 py-3 text-right`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.revenueId} className="border-b border-mint-50 last:border-0">
                        <td className={`${tableCellClass} text-ink-600`}>{new Date(r.transactionDate).toLocaleString()}</td>
                        <td className={tableCellClass}>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${r.transactionType === 'Export' ? 'bg-violet-100 text-violet-800' : 'bg-sky-100 text-sky-800'}`}>
                            {r.transactionType === 'LocalSale' ? 'Local sale' : 'Export'}
                          </span>
                        </td>
                        <td className={`${tableCellClass} font-mono text-xs`}>{r.referenceId.slice(0, 8)}…</td>
                        <td className={tableCellClass}>{r.recordedByName}</td>
                        <td className={`${tableCellClass} text-right font-bold`}>Rs. {r.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-mint-200">
                      <td colSpan={4} className={`${tableCellClass} text-right font-bold`}>Filtered total</td>
                      <td className={`${tableCellClass} text-right text-base font-bold text-mint-700`}>Rs. {filteredTotal.toFixed(2)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
};

// ---------- Helpers ----------
const percentOf = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(1)}% of total` : '—';

const SummaryCard: React.FC<{ label: string; value: number; sub: string; tone: string }> = ({ label, value, sub, tone }) => (
  <GlassCard hover={false} className="p-5">
    <div className={`mb-1.5 flex items-center gap-2 ${tone}`}>
      <TrendingUp size={18} />
      <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
    </div>
    <div className="font-display text-2xl font-bold text-ink-900">Rs. {value.toFixed(2)}</div>
    <div className="mt-1 text-xs text-ink-600">{sub}</div>
  </GlassCard>
);

export default RevenuePage;
