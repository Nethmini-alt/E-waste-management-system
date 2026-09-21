/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, RefreshCw, Ship, Eye, Trash2, ChevronDown,
} from 'lucide-react';
import { exportOrderApi } from './exportOrderApi';
import type { ExportOrder, CreateExportOrderRequest } from './types';
import ExportOrderFormModal from './ExportOrderFormModal';
import ExportOrderDetailModal from './ExportOrderDetailModal';
import { buyerApi } from '../Buyers/buyerApi';
import type { Buyer } from '../Buyers/types';
import { useAuth } from '../../auth/AuthContext';

const ExportOrdersListPage: React.FC = () => {
  const { hasRole } = useAuth();
  const isAdmin = hasRole('admin');

  const [orders, setOrders] = useState<ExportOrder[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ExportOrder['status']>('All');
  const [buyerFilter, setBuyerFilter] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<ExportOrder | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, buyersData] = await Promise.all([
        exportOrderApi.list(),
        buyerApi.list(),
      ]);
      setOrders(ordersData);
      setBuyers(buyersData.filter((b) => b.buyerType === 'Export'));
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load export orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return orders.filter((o) => {
      const matchesSearch =
        o.buyerCompanyName.toLowerCase().includes(q) ||
        o.destinationCountry.toLowerCase().includes(q) ||
        o.exportOrderId.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
      const matchesBuyer = !buyerFilter || o.buyerId === buyerFilter;
      return matchesSearch && matchesStatus && matchesBuyer;
    });
  }, [orders, search, statusFilter, buyerFilter]);

  const handleCreate = async (body: CreateExportOrderRequest) => {
    await exportOrderApi.create(body);
    setCreateOpen(false);
    await load();
  };

  const handleStatusChange = async (order: ExportOrder, status: ExportOrder['status']) => {
    if (status === 'Cancelled' && !confirm('Cancel this export order? This cannot be undone.')) return;
    if (status === 'Approved' && !confirm('Approve this export for shipment?')) return;

    try {
      await exportOrderApi.updateStatus(order.exportOrderId, { status });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to update status.');
    }
  };

  const handleDelete = async (order: ExportOrder) => {
    if (!confirm(`Delete draft export ${order.exportOrderId.slice(0, 8)}…?`)) return;
    try {
      await exportOrderApi.remove(order.exportOrderId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to delete.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Ship size={22} /> Export Orders
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setCreateOpen(true)} style={btnPrimary}>
            <Plus size={14} /> New Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
        <div style={{ ...searchBox, flex: 1, minWidth: 220 }}>
          <Search size={16} color="#888" />
          <input
            placeholder="Search buyer, destination, or order ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={selectStyle}>
          <option value="All">All Statuses</option>
          <option value="Draft">Draft</option>
          <option value="PendingApproval">Pending Approval</option>
          <option value="Approved">Approved</option>
          <option value="Shipped">Shipped</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)} style={selectStyle}>
          <option value="">All Export Buyers</option>
          {buyers.map((b) => (
            <option key={b.buyerId} value={b.buyerId}>{b.companyName}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading export orders…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={emptyBox}>
          <Ship size={40} color="#bbb" />
          <p>No export orders match your filters. Click <strong>New Export</strong> to create one.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={th}>Order</th>
              <th style={th}>Buyer</th>
              <th style={th}>Destination</th>
              <th style={th}>Shipment</th>
              <th style={{ ...th, textAlign: 'right' }}>Weight</th>
              <th style={{ ...th, textAlign: 'right' }}>Value</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.exportOrderId} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                  {o.exportOrderId.slice(0, 8)}…
                </td>
                <td style={{ ...td, fontWeight: 'bold' }}>{o.buyerCompanyName}</td>
                <td style={td}>{o.destinationCountry}</td>
                <td style={{ ...td, fontSize: 13, color: '#666' }}>{o.shipmentDate}</td>
                <td style={{ ...td, textAlign: 'right' }}>{o.totalWeightKg.toFixed(2)} kg</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>
                  Rs. {o.totalValue.toFixed(2)}
                </td>
                <td style={td}>
                  <StatusDropdown
                    status={o.status}
                    isAdmin={isAdmin}
                    onChange={(s) => handleStatusChange(o, s)}
                  />
                </td>
                <td style={td}>
                  <button onClick={() => setDetailOrder(o)} style={iconBtn} title="View">
                    <Eye size={16} />
                  </button>
                  {o.status === 'Draft' && (
                    <button
                      onClick={() => handleDelete(o)}
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

      <ExportOrderFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <ExportOrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
    </div>
  );
};

// ---------- Status dropdown with role awareness ----------
const StatusDropdown: React.FC<{
  status: ExportOrder['status'];
  isAdmin: boolean;
  onChange: (s: ExportOrder['status']) => void;
}> = ({ status, isAdmin, onChange }) => {
  const colors: Record<ExportOrder['status'], { bg: string; fg: string }> = {
    Draft: { bg: '#fff3e0', fg: '#e65100' },
    PendingApproval: { bg: '#fff8e1', fg: '#f57f17' },
    Approved: { bg: '#e3f2fd', fg: '#1565c0' },
    Shipped: { bg: '#e1f5fe', fg: '#0277bd' },
    Completed: { bg: '#e8f5e9', fg: '#2e7d32' },
    Cancelled: { bg: '#ffebee', fg: '#c62828' },
  };
  const c = colors[status];

  // Terminal states
  if (status === 'Completed' || status === 'Cancelled') {
    return (
      <span
        style={{
          background: c.bg, color: c.fg, padding: '4px 10px', borderRadius: 4,
          fontSize: 12, fontWeight: 'bold',
        }}
      >
        {status}
      </span>
    );
  }

  // Legal transitions depend on current status AND role
  let options: ExportOrder['status'][];
  switch (status) {
    case 'Draft':
      options = ['Draft', 'PendingApproval', 'Cancelled'];
      break;
    case 'PendingApproval':
      // Only admins can approve; staff can send back or cancel
      options = isAdmin
        ? ['PendingApproval', 'Approved', 'Draft', 'Cancelled']
        : ['PendingApproval', 'Draft', 'Cancelled'];
      break;
    case 'Approved':
      options = ['Approved', 'Shipped', 'Cancelled'];
      break;
    case 'Shipped':
      options = ['Shipped', 'Completed'];
      break;
    default:
      options = [status];
  }

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as ExportOrder['status'])}
        style={{
          background: c.bg, color: c.fg, border: 'none', padding: '4px 26px 4px 10px',
          borderRadius: 4, fontSize: 12, fontWeight: 'bold', cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o === 'PendingApproval' ? 'Pending Approval' : o}
            {o === 'Approved' && !isAdmin ? '' : ''}
          </option>
        ))}
      </select>
      <ChevronDown
        size={12}
        style={{
          position: 'absolute', right: 8, top: '50%',
          transform: 'translateY(-50%)', pointerEvents: 'none', color: c.fg,
        }}
      />
    </div>
  );
};

// ---------- Styles ----------
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
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 6, marginRight: 4,
};
const searchBox: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: '#fff', border: '1px solid #ccc', borderRadius: 6, padding: '0 10px',
};
const searchInput: React.CSSProperties = { flex: 1, border: 'none', outline: 'none', padding: 8 };
const selectStyle: React.CSSProperties = { padding: 8, borderRadius: 6, border: '1px solid #ccc' };
const errorBox: React.CSSProperties = { padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6 };
const emptyBox: React.CSSProperties = {
  padding: 40, background: '#fff', borderRadius: 8, textAlign: 'center', color: '#888',
  border: '1px dashed #ccc',
};

export default ExportOrdersListPage;