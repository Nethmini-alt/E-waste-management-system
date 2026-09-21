/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, Tag, CheckCircle2, Clock,
} from 'lucide-react';
import { pricingApi } from './pricingApi';
import type { MaterialPricing } from './types';
import MaterialPricingFormModal, {
  type MaterialPricingFormValues,
} from './MaterialPricingFormModal';

const MaterialPricingListPage: React.FC = () => {
  const [rows, setRows] = useState<MaterialPricing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | MaterialPricing['status']>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<MaterialPricing | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await pricingApi.list());
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load pricing.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter((p) => {
      const matchesSearch =
        p.materialType.toLowerCase().includes(q) || p.createdByName.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  const handleCreate = async (values: MaterialPricingFormValues) => {
    try {
      await pricingApi.create({
        materialType: values.materialType,
        pricePerKg: values.pricePerKg,
        effectiveDate: values.effectiveDate,
        expiryDate: values.expiryDate || null,
      });
      setModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to create pricing.');
    }
  };

  const handleUpdate = async (values: MaterialPricingFormValues) => {
    if (!editing) return;
    try {
      await pricingApi.update(editing.pricingId, {
        materialType: values.materialType,
        pricePerKg: values.pricePerKg,
        effectiveDate: values.effectiveDate,
        expiryDate: values.expiryDate || null,
        status: editing.status,
      });
      setEditing(null);
      setModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to update pricing.');
    }
  };

  const handleStatusChange = async (p: MaterialPricing, status: MaterialPricing['status']) => {
    if (status === 'Approved' && !confirm(
      `Approve Rs. ${p.pricePerKg} / kg for ${p.materialType}?\n\nAny currently-approved price for this material will be marked Expired.`
    )) return;

    try {
      await pricingApi.update(p.pricingId, {
        materialType: p.materialType,
        pricePerKg: p.pricePerKg,
        effectiveDate: p.effectiveDate,
        expiryDate: p.expiryDate,
        status,
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to update status.');
    }
  };

  const handleDelete = async (p: MaterialPricing) => {
    if (!confirm(`Delete draft pricing for ${p.materialType}?`)) return;
    try {
      await pricingApi.remove(p.pricingId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to delete.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag size={22} /> Material Pricing
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            style={btnPrimary}
          >
            <Plus size={14} /> New Price
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
        <div style={searchBox}>
          <Search size={16} color="#888" />
          <input
            placeholder="Search material or author…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={selectStyle}
        >
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="Approved">Approved</option>
          <option value="Expired">Expired</option>
        </select>
      </div>

      {loading && <p>Loading pricing…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={emptyBox}>
          <Tag size={40} color="#bbb" />
          <p>No pricing rows found. Click <strong>New Price</strong> to add one.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={th}>Material</th>
              <th style={th}>Price / kg</th>
              <th style={th}>Effective</th>
              <th style={th}>Expiry</th>
              <th style={th}>Status</th>
              <th style={th}>Created By</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.pricingId} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ ...td, fontWeight: 'bold' }}>{p.materialType}</td>
                <td style={td}>Rs. {p.pricePerKg.toFixed(2)}</td>
                <td style={td}>{p.effectiveDate}</td>
                <td style={td}>{p.expiryDate ?? '—'}</td>
                <td style={td}>
                  <StatusPill status={p.status} />
                </td>
                <td style={{ ...td, fontSize: 13, color: '#666' }}>
                  {p.createdByName || '—'}
                </td>
                <td style={td}>
                  {p.status === 'Draft' && (
                    <button
                      onClick={() => handleStatusChange(p, 'Approved')}
                      style={{ ...iconBtn, color: '#2e7d32' }}
                      title="Approve"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  {p.status === 'Approved' && (
                    <button
                      onClick={() => handleStatusChange(p, 'Expired')}
                      style={{ ...iconBtn, color: '#e65100' }}
                      title="Mark Expired"
                    >
                      <Clock size={16} />
                    </button>
                  )}
                  <button
                    onClick={() => { setEditing(p); setModalOpen(true); }}
                    style={iconBtn}
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  {p.status === 'Draft' && (
                    <button
                      onClick={() => handleDelete(p)}
                      style={{ ...iconBtn, color: '#c62828' }}
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <MaterialPricingFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={editing ? handleUpdate : handleCreate}
        initial={
          editing
            ? {
                materialType: editing.materialType,
                pricePerKg: editing.pricePerKg,
                effectiveDate: editing.effectiveDate,
                expiryDate: editing.expiryDate ?? '',
              }
            : undefined
        }
        title={editing ? 'Edit Pricing' : 'New Pricing'}
      />
    </div>
  );
};

const StatusPill: React.FC<{ status: MaterialPricing['status'] }> = ({ status }) => {
  const map = {
    Draft: { bg: '#fff3e0', fg: '#e65100' },
    Approved: { bg: '#e8f5e9', fg: '#2e7d32' },
    Expired: { bg: '#eceff1', fg: '#546e7a' },
  } as const;
  const c = map[status];
  return (
    <span
      style={{
        background: c.bg, color: c.fg, fontWeight: 'bold',
        fontSize: 12, padding: '4px 10px', borderRadius: 4,
      }}
    >
      {status}
    </span>
  );
};

const th: React.CSSProperties = { padding: 10, fontSize: 13, fontWeight: 'bold' };
const td: React.CSSProperties = { padding: 10, fontSize: 14 };
const btnPrimary: React.CSSProperties = {
  background: '#1565c0', color: '#fff', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', fontWeight: 'bold',
  display: 'flex', alignItems: 'center', gap: 6,
};
const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '8px 14px',
  borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer',
  padding: 6, marginRight: 4,
};
const searchBox: React.CSSProperties = {
  flex: 1, display: 'flex', alignItems: 'center', gap: 6,
  background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '0 10px',
};
const searchInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', padding: 8 };
const selectStyle: React.CSSProperties = {
  padding: 8, borderRadius: 6, border: '1px solid #ccc',
};
const errorBox: React.CSSProperties = {
  padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6,
};
const emptyBox: React.CSSProperties = {
  padding: 40, background: '#fff', borderRadius: 8, textAlign: 'center', color: '#888',
  border: '1px dashed #ccc',
};

export default MaterialPricingListPage;