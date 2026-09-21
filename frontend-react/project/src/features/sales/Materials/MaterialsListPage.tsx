/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { Package, Search, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { materialApi } from './materialApi';
import type { RecoveredMaterial } from './types';

const MaterialsListPage: React.FC = () => {
  const [rows, setRows] = useState<RecoveredMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        onlyAvailable
          ? await materialApi.listAvailable()
          : await materialApi.listAll()
      );
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [onlyAvailable]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(
      (m) =>
        m.materialType.toLowerCase().includes(q) ||
        m.qualityGrade.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Package size={22} /> Recovered Materials
        </h2>
        <button onClick={load} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
        <div style={searchBox}>
          <Search size={16} color="#888" />
          <input
            placeholder="Search material or grade…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />
        </div>
        <label style={toggleLabel}>
          <input
            type="checkbox"
            checked={onlyAvailable}
            onChange={(e) => setOnlyAvailable(e.target.checked)}
          />
          Only sellable
        </label>
      </div>

      <p style={{ fontSize: 13, color: '#666', marginBottom: 15 }}>
        Read-only view. Source: Component C. These batches are inputs to pricing, sales, and export.
      </p>

      {loading && <p>Loading materials…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={emptyBox}>
          <Package size={40} color="#bbb" />
          <p>No materials match your filters.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={th}>Material</th>
              <th style={th}>Quantity (kg)</th>
              <th style={th}>Grade</th>
              <th style={th}>Processing</th>
              <th style={th}>Safety</th>
              <th style={th}>Available</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((m) => (
              <tr key={m.recoveredMaterialId} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ ...td, fontWeight: 'bold' }}>{m.materialType}</td>
                <td style={td}>{m.quantityKg.toFixed(2)}</td>
                <td style={td}>{m.qualityGrade}</td>
                <td style={td}>
                  <ProcessingPill status={m.processingStatus} />
                </td>
                <td style={td}>
                  {m.safetyValidated ? (
                    <span style={{ color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                      <CheckCircle2 size={14} /> Validated
                    </span>
                  ) : (
                    <span style={{ color: '#c62828', display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
                      <AlertTriangle size={14} /> Not validated
                    </span>
                  )}
                </td>
                <td style={{ ...td, color: '#666', fontSize: 13 }}>
                  {new Date(m.availableAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

const ProcessingPill: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; fg: string }> = {
    Ready: { bg: '#e8f5e9', fg: '#2e7d32' },
    InProgress: { bg: '#fff3e0', fg: '#e65100' },
    Rejected: { bg: '#ffebee', fg: '#c62828' },
  };
  const c = map[status] ?? { bg: '#eceff1', fg: '#546e7a' };
  return (
    <span style={{ background: c.bg, color: c.fg, padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>
      {status}
    </span>
  );
};

const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};
const searchBox: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', gap: 6,
  background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '0 10px',
};
const searchInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', padding: 8 };
const toggleLabel: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer',
};
const errorBox: React.CSSProperties = { padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6 };
const emptyBox: React.CSSProperties = {
  padding: 40, background: '#fff', borderRadius: 8, textAlign: 'center', color: '#888',
  border: '1px dashed #ccc',
};
const th: React.CSSProperties = { padding: 10, fontSize: 13, fontWeight: 'bold' };
const td: React.CSSProperties = { padding: 10, fontSize: 14 };

export default MaterialsListPage;