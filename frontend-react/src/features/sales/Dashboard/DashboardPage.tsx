/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Tag, Package, DollarSign, RefreshCw, ArrowRight, TrendingUp,
} from 'lucide-react';
import { dashboardApi } from './dashboardApi';
import type { Buyer } from '../Buyers/types';
import type { MaterialPricing } from '../Pricing/types';
import type { RecoveredMaterial } from '../Materials/types';

interface DashboardData {
  buyers: Buyer[];
  pricing: MaterialPricing[];
  availableMaterials: RecoveredMaterial[];
}

const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [buyers, pricing, availableMaterials] = await Promise.all([
        dashboardApi.buyers(),
        dashboardApi.pricing(),
        dashboardApi.availableMaterials(),
      ]);
      setData({ buyers, pricing, availableMaterials });
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const stats = data
    ? {
        totalBuyers: data.buyers.length,
        activeBuyers: data.buyers.filter((b) => b.status === 'Active').length,
        approvedPrices: data.pricing.filter((p) => p.status === 'Approved').length,
        sellableTonnes:
          data.availableMaterials.reduce((sum, m) => sum + m.quantityKg, 0) / 1000,
      }
    : null;

  const recentPricing = data?.pricing.slice(0, 5) ?? [];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 25,
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Commercial Dashboard</h2>
          <p style={{ color: '#666', marginTop: 4 }}>
            Component D — commercial value recovery overview
          </p>
        </div>
        <button onClick={load} style={btnSecondary}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading && <p>Loading dashboard…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && stats && (
        <>
          {/* Stat cards */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 15,
              marginBottom: 25,
            }}
          >
            <StatCard
              icon={<Users size={20} />}
              label="Buyers"
              value={stats.totalBuyers}
              sub={`${stats.activeBuyers} active`}
              color="#1565c0"
              onClick={() => navigate('/buyers')}
            />
            <StatCard
              icon={<Tag size={20} />}
              label="Approved Prices"
              value={stats.approvedPrices}
              sub={`${data?.pricing.length ?? 0} total rows`}
              color="#2e7d32"
              onClick={() => navigate('/pricing')}
            />
            <StatCard
              icon={<Package size={20} />}
              label="Sellable Materials"
              value={stats.sellableTonnes.toFixed(2)}
              sub={`${data?.availableMaterials.length ?? 0} batches (tonnes)`}
              color="#e65100"
              onClick={() => navigate('/materials')}
            />
            <StatCard
              icon={<DollarSign size={20} />}
              label="Revenue"
              value="—"
              sub="Coming in Part 12"
              color="#6a1b9a"
              onClick={() => navigate('/revenue')}
            />
          </div>

          {/* Available materials */}
          <Section
            title="Available Recovered Materials"
            action={{
              label: 'View all',
              onClick: () => navigate('/materials'),
            }}
          >
            {data!.availableMaterials.length === 0 ? (
              <EmptyRow message="No sellable materials right now." />
            ) : (
              <table style={table}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th}>Material</th>
                    <th style={th}>Quantity (kg)</th>
                    <th style={th}>Grade</th>
                    <th style={th}>Available</th>
                  </tr>
                </thead>
                <tbody>
                  {data!.availableMaterials.slice(0, 5).map((m) => (
                    <tr key={m.recoveredMaterialId} style={trBody}>
                      <td style={{ ...td, fontWeight: 'bold' }}>{m.materialType}</td>
                      <td style={td}>{m.quantityKg.toFixed(2)}</td>
                      <td style={td}>{m.qualityGrade}</td>
                      <td style={{ ...td, color: '#666', fontSize: 13 }}>
                        {new Date(m.availableAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          {/* Recent pricing */}
          <Section
            title="Recent Pricing"
            action={{
              label: 'Manage',
              onClick: () => navigate('/pricing'),
            }}
          >
            {recentPricing.length === 0 ? (
              <EmptyRow message="No pricing rows yet." />
            ) : (
              <table style={table}>
                <thead>
                  <tr style={theadRow}>
                    <th style={th}>Material</th>
                    <th style={th}>Price / kg</th>
                    <th style={th}>Effective</th>
                    <th style={th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPricing.map((p) => (
                    <tr key={p.pricingId} style={trBody}>
                      <td style={{ ...td, fontWeight: 'bold' }}>{p.materialType}</td>
                      <td style={td}>Rs. {p.pricePerKg.toFixed(2)}</td>
                      <td style={td}>{p.effectiveDate}</td>
                      <td style={td}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: '3px 8px',
                            borderRadius: 4,
                            fontWeight: 'bold',
                            background:
                              p.status === 'Approved'
                                ? '#e8f5e9'
                                : p.status === 'Draft'
                                ? '#fff3e0'
                                : '#eceff1',
                            color:
                              p.status === 'Approved'
                                ? '#2e7d32'
                                : p.status === 'Draft'
                                ? '#e65100'
                                : '#546e7a',
                          }}
                        >
                          {p.status}
                        </span>
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

// ---------- Sub-components ----------

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  color: string;
  onClick?: () => void;
}> = ({ icon, label, value, sub, color, onClick }) => (
  <div
    onClick={onClick}
    style={{
      background: '#fff',
      padding: 18,
      borderRadius: 10,
      border: '1px solid #eee',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'box-shadow 0.15s',
    }}
    onMouseEnter={(e) =>
      onClick && (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.06)')
    }
    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color, marginBottom: 6 }}>
      {icon}
      <span style={{ fontSize: 13, fontWeight: 'bold', textTransform: 'uppercase' }}>
        {label}
      </span>
    </div>
    <div style={{ fontSize: 28, fontWeight: 'bold', color: '#222' }}>{value}</div>
    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{sub}</div>
  </div>
);

const Section: React.FC<{
  title: string;
  action?: { label: string; onClick: () => void };
  children: React.ReactNode;
}> = ({ title, action, children }) => (
  <div style={{ marginBottom: 25 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
      <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
      {action && (
        <button
          onClick={action.onClick}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#1565c0',
            cursor: 'pointer',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 13,
          }}
        >
          {action.label} <ArrowRight size={14} />
        </button>
      )}
    </div>
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #eee', overflow: 'hidden' }}>
      {children}
    </div>
  </div>
);

const EmptyRow: React.FC<{ message: string }> = ({ message }) => (
  <div style={{ padding: 25, textAlign: 'center', color: '#888', fontSize: 13 }}>
    {message}
  </div>
);

// ---------- Styles ----------
const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};
const errorBox: React.CSSProperties = {
  padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6,
};
const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse' };
const theadRow: React.CSSProperties = { background: '#fafafa', textAlign: 'left' };
const trBody: React.CSSProperties = { borderTop: '1px solid #f0f0f0' };
const th: React.CSSProperties = { padding: 10, fontSize: 12, fontWeight: 'bold', color: '#666' };
const td: React.CSSProperties = { padding: 10, fontSize: 14 };

export default DashboardPage;