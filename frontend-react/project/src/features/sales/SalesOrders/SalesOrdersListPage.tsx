/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, ShoppingCart, Eye, Trash2, ChevronDown,
} from 'lucide-react';
import { salesOrderApi } from './salesOrderApi';
import type { SalesOrder, CreateSalesOrderRequest } from './types';
import SalesOrderFormModal from './SalesOrderFormModal';
import SalesOrderDetailModal from './SalesOrderDetailModal';
import { buyerApi } from '../Buyers/buyerApi';
import type { Buyer } from '../Buyers/types';

const SalesOrdersListPage: React.FC = () => {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | SalesOrder['status']>('All');
  const [buyerFilter, setBuyerFilter] = useState<string>('');

  const [createOpen, setCreateOpen] = useState(false);
  const [detailOrder, setDetailOrder] = useState<SalesOrder | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [ordersData, buyersData] = await Promise.all([
        salesOrderApi.list(),
        buyerApi.list(),
      ]);
      setOrders(ordersData);
      setBuyers(buyersData);
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load orders.');
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
        o.salesOrderId.toLowerCase().includes(q) ||
        (o.pendingMaterialType ?? '').toLowerCase().includes(q) ||
        o.items.some((item) => item.materialType.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'All' || o.status === statusFilter;
      const matchesBuyer = !buyerFilter || o.buyerId === buyerFilter;
      return matchesSearch && matchesStatus && matchesBuyer;
    });
  }, [orders, search, statusFilter, buyerFilter]);

  const handleCreate = async (body: CreateSalesOrderRequest) => {
    await salesOrderApi.create(body);
    setCreateOpen(false);
    await load();
  };

  const handleStatusChange = async (order: SalesOrder, status: SalesOrder['status']) => {
    if (status === 'Cancelled' && !confirm('Cancel this order? This cannot be undone.')) return;
    try {
      await salesOrderApi.updateStatus(order.salesOrderId, { status });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to update status.');
    }
  };

  const handleDelete = async (order: SalesOrder) => {
    if (!confirm(`Delete draft order ${order.salesOrderId.slice(0, 8)}…?`)) return;
    try {
      await salesOrderApi.remove(order.salesOrderId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to delete.');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShoppingCart size={22} /> Sales Orders
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
          <button onClick={() => setCreateOpen(true)} style={btnPrimary}>
            <Plus size={14} /> New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15, flexWrap: 'wrap' }}>
        <div style={{ ...searchBox, flex: 1, minWidth: 220 }}>
          <Search size={16} color="#888" />
          <input
            placeholder="Search buyer or order ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} style={selectStyle}>
          <option value="All">All Statuses</option>
          <option value="WaitingForStock">Waiting for stock</option>
          <option value="PendingPlanApproval">Plan approval</option>
          <option value="Draft">Draft</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)} style={selectStyle}>
          <option value="">All Buyers</option>
          {buyers.map((b) => (
            <option key={b.buyerId} value={b.buyerId}>{b.companyName}</option>
          ))}
        </select>
      </div>

      {loading && <p>Loading orders…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={emptyBox}>
          <ShoppingCart size={40} color="#bbb" />
          <p>No orders match your filters. Click <strong>New Order</strong> to create one.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={th}>Order</th>
              <th style={th}>Buyer</th>
              <th style={th}>Date</th>
              <th style={th}>Items</th>
              <th style={{ ...th, textAlign: 'right' }}>Total</th>
              <th style={th}>Status</th>
              <th style={th}>Plan</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.salesOrderId} style={{ borderTop: '1px solid #eee' }}>
                <td style={{ ...td, fontFamily: 'monospace', fontSize: 12 }}>
                  {o.salesOrderId.slice(0, 8)}…
                </td>
                <td style={{ ...td, fontWeight: 'bold' }}>{o.buyerCompanyName}</td>
                <td style={{ ...td, fontSize: 13, color: '#666' }}>
                  {new Date(o.orderDate).toLocaleDateString()}
                </td>
                <td style={td}>
                  {o.items.length > 0
                    ? o.items.map((item) => `${item.materialType} (${item.quantityKg.toLocaleString()} kg)`).join(', ')
                    : `${o.pendingMaterialType ?? 'Material'} (${(o.pendingQuantityKg ?? 0).toLocaleString()} kg)`}
                </td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>
                  Rs. {o.totalAmount.toFixed(2)}
                </td>
                <td style={td}>
                  <StatusDropdown
                    status={o.status}
                    materialRequestStatus={o.materialRequestStatus}
                    onChange={(s) => handleStatusChange(o, s)}
                  />
                </td>
                <td style={td}>
                  {o.commercialPlanId
                    ? <Link to={`/plans/${o.commercialPlanId}`}>Review plan</Link>
                    : o.status === 'WaitingForStock' ? 'Waiting for stock' : '—'}
                </td>
                <td style={td}>
                  <button onClick={() => setDetailOrder(o)} style={iconBtn} title="View">
                    <Eye size={16} />
                  </button>
                  {o.status === 'Draft' && !o.materialRequestId && (
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

      <SalesOrderFormModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <SalesOrderDetailModal order={detailOrder} onClose={() => setDetailOrder(null)} />
    </div>
  );
};

// ---------- Status dropdown ----------
const StatusDropdown: React.FC<{
  status: SalesOrder['status'];
  materialRequestStatus?: SalesOrder['materialRequestStatus'];
  onChange: (s: SalesOrder['status']) => void;
}> = ({ status, materialRequestStatus, onChange }) => {
  const colors: Record<SalesOrder['status'], { bg: string; fg: string }> = {
    WaitingForStock: { bg: '#fff3e0', fg: '#a45b00' },
    PendingPlanApproval: { bg: '#e3f2fd', fg: '#1565c0' },
    Draft: { bg: '#fff3e0', fg: '#e65100' },
    Confirmed: { bg: '#e3f2fd', fg: '#1565c0' },
    Completed: { bg: '#e8f5e9', fg: '#2e7d32' },
    Cancelled: { bg: '#ffebee', fg: '#c62828' },
  };
  const c = colors[status];

  const requestStatusLabels: Partial<Record<NonNullable<SalesOrder['materialRequestStatus']>, string>> = {
    Waiting: 'Waiting for stock',
    GeneratingPlan: 'Generating plan',
    PlanGenerated: 'Awaiting admin approval',
    PlanGenerationFailed: 'Plan retrying',
    OrderPlaced: 'Order placed',
    Fulfilled: 'Fulfilled',
    Cancelled: 'Cancelled',
  };
  const displayStatus = materialRequestStatus
    ? requestStatusLabels[materialRequestStatus] ?? status
    : status;

  // Terminal states: render as a static pill
  if (status === 'WaitingForStock' || status === 'PendingPlanApproval' || status === 'Completed' || status === 'Cancelled') {
    return (
      <span
        style={{
          background: c.bg, color: c.fg, padding: '4px 10px', borderRadius: 4,
          fontSize: 12, fontWeight: 'bold',
        }}
      >
        {displayStatus}
      </span>
    );
  }

  const options: SalesOrder['status'][] = status === 'Draft'
    ? ['Draft', 'Confirmed', 'Cancelled']
    : ['Confirmed', 'Completed', 'Cancelled'];

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as SalesOrder['status'])}
        style={{
          background: c.bg, color: c.fg, border: 'none', padding: '4px 26px 4px 10px',
          borderRadius: 4, fontSize: 12, fontWeight: 'bold', cursor: 'pointer',
          appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
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
  background: '#eee', color: '#1f1f1f', border: 'none', padding: '8px 14px',
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

export default SalesOrdersListPage;