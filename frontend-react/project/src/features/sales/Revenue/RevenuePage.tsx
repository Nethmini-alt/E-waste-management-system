/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, Download, RefreshCw, Search, Filter,
} from 'lucide-react';
import { revenueApi } from './revenueApi';
import type { RevenueTransaction, RevenueSummary } from './types';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <DollarSign size={22} /> Revenue
          </h2>
          <p style={{ color: '#666', marginTop: 4 }}>
            Ledger of completed commercial transactions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
        </div>
      </div>

      {loading && <p>Loading revenue…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && summary && (
        <>
          {/* Summary cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 15,
              marginBottom: 25,
            }}
          >
            <SummaryCard
              label="Total Revenue"
              value={summary.totalRevenue}
              sub={`${summary.transactionCount} transactions`}
              color="#2e7d32"
            />
            <SummaryCard
              label="Local Sales"
              value={summary.localSaleRevenue}
              sub={percentOf(summary.localSaleRevenue, summary.totalRevenue)}
              color="#1565c0"
            />
            <SummaryCard
              label="Export"
              value={summary.exportRevenue}
              sub={percentOf(summary.exportRevenue, summary.totalRevenue)}
              color="#6a1b9a"
            />
          </div>

          {/* Monthly breakdown */}
          {summary.monthly.length > 0 && (
            <div style={{ marginBottom: 25 }}>
              <h3 style={{ fontSize: 16, marginBottom: 10 }}>Monthly Breakdown</h3>
              <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#fafafa', textAlign: 'left' }}>
                      <th style={th}>Month</th>
                      <th style={{ ...th, textAlign: 'right' }}>Transactions</th>
                      <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                      <th style={{ ...th, width: '40%' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.monthly.map((m) => {
                      const pct = summary.totalRevenue > 0 ? (m.amount / summary.totalRevenue) * 100 : 0;
                      return (
                        <tr key={m.month} style={{ borderTop: '1px solid #f0f0f0' }}>
                          <td style={{ ...td, fontWeight: 'bold' }}>{m.month}</td>
                          <td style={{ ...td, textAlign: 'right' }}>{m.count}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>
                            Rs. {m.amount.toFixed(2)}
                          </td>
                          <td style={td}>
                            <div style={{ background: '#e8f5e9', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: '100%',
                                  background: '#2e7d32',
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Transactions list */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h3 style={{ fontSize: 16, margin: 0 }}>Transactions</h3>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={searchBox}>
                <Search size={16} color="#888" />
                <input
                  placeholder="Search by reference or remarks…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={searchInput}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Filter size={14} color="#555" />
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value as any)}
                  style={selectStyle}
                >
                  <option value="All">All Types</option>
                  <option value="LocalSale">Local Sale</option>
                  <option value="Export">Export</option>
                </select>
              </div>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div style={emptyBox}>
              <DollarSign size={40} color="#bbb" />
              <p>
                {rows.length === 0
                  ? 'No revenue transactions yet. Complete a sales or export order to generate one.'
                  : 'No transactions match your filters.'}
              </p>
            </div>
          ) : (
            <>
              <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                    <th style={th}>Date</th>
                    <th style={th}>Type</th>
                    <th style={th}>Reference</th>
                    <th style={th}>Recorded By</th>
                    <th style={{ ...th, textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.revenueId} style={{ borderTop: '1px solid #eee' }}>
                      <td style={{ ...td, fontSize: 13, color: '#666' }}>
                        {new Date(r.transactionDate).toLocaleString()}
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            fontSize: 12, padding: '3px 8px', borderRadius: 4, fontWeight: 'bold',
                            background: r.transactionType === 'Export' ? '#f3e5f5' : '#e3f2fd',
                            color: r.transactionType === 'Export' ? '#6a1b9a' : '#1565c0',
                          }}
                        >
                          {r.transactionType === 'LocalSale' ? 'Local Sale' : 'Export'}
                        </span>
                      </td>
                      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                        {r.referenceId.slice(0, 8)}…
                      </td>
                      <td style={td}>{r.recordedByName}</td>
                      <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>
                        Rs. {r.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid #ddd' }}>
                    <td colSpan={4} style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>
                      Filtered Total
                    </td>
                    <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', fontSize: 15 }}>
                      Rs. {filteredTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
};

// ---------- Helpers ----------
const percentOf = (part: number, total: number) =>
  total > 0 ? `${((part / total) * 100).toFixed(1)}% of total` : '—';

const SummaryCard: React.FC<{
  label: string;
  value: number;
  sub: string;
  color: string;
}> = ({ label, value, sub, color }) => (
  <div
    style={{
      background: '#fff', padding: 18, borderRadius: 10, border: '1px solid #eee',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 6 }}>
      <TrendingUp size={20} />
      <span style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>{label}</span>
    </div>
    <div style={{ fontSize: 24, fontWeight: 'bold', color: '#222' }}>
      Rs. {value.toFixed(2)}
    </div>
    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{sub}</div>
  </div>
);

// ---------- Styles ----------
const th: React.CSSProperties = { padding: 10, fontSize: 13, fontWeight: 'bold' };
const td: React.CSSProperties = { padding: 10, fontSize: 14 };
const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};
const searchBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '0 10px',
  minWidth: 220,
};
const searchInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', padding: 8 };
const selectStyle: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #ccc' };
const errorBox: React.CSSProperties = { padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6 };
const emptyBox: React.CSSProperties = {
  padding: 40, background: '#fff', borderRadius: 8, textAlign: 'center', color: '#888',
  border: '1px dashed #ccc',
};

export default RevenuePage;