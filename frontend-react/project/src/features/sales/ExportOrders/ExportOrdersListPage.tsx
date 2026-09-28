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
import {
  EmptyState, ErrorMessage, GlassCard, PageHeader,
  btnPrimary, btnSecondary, inputClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';

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
      <PageHeader
        title="Export orders"
        icon={Ship}
        actions={
          <>
            <button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            <button onClick={() => setCreateOpen(true)} className={btnPrimary}><Plus size={14} /> New export</button>
          </>
        }
      />

      <GlassCard hover={false} className="mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
            <input
              placeholder="Search buyer, destination, or order ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={`${inputClass} !w-auto`}>
            <option value="All">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="PendingApproval">Pending approval</option>
            <option value="Approved">Approved</option>
            <option value="Shipped">Shipped</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)} className={`${inputClass} !w-auto`}>
            <option value="">All export buyers</option>
            {buyers.map((b) => (
              <option key={b.buyerId} value={b.buyerId}>{b.companyName}</option>
            ))}
          </select>
        </div>
      </GlassCard>

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !orders.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-600">Loading export orders…</p>
        ) : !error && filtered.length === 0 ? (
          <EmptyState icon={Ship} title="No export orders match your filters" description='Click "New export" to create one.' />
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Order</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Buyer</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Destination</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Shipment</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Weight</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Value</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.exportOrderId} className="border-b border-mint-50 last:border-0">
                    <td className={`${tableCellClass} font-mono text-xs`}>{o.exportOrderId.slice(0, 8)}…</td>
                    <td className={`${tableCellClass} font-semibold text-ink-900`}>{o.buyerCompanyName}</td>
                    <td className={tableCellClass}>{o.destinationCountry}</td>
                    <td className={`${tableCellClass} text-ink-600`}>{o.shipmentDate}</td>
                    <td className={`${tableCellClass} text-right`}>{o.totalWeightKg.toFixed(2)} kg</td>
                    <td className={`${tableCellClass} text-right font-bold`}>Rs. {o.totalValue.toFixed(2)}</td>
                    <td className={tableCellClass}>
                      <StatusDropdown status={o.status} isAdmin={isAdmin} onChange={(s) => handleStatusChange(o, s)} />
                    </td>
                    <td className={tableCellClass}>
                      <button onClick={() => setDetailOrder(o)} className="mr-1 rounded-lg p-1.5 text-ink-700 hover:bg-mint-50" title="View">
                        <Eye size={16} />
                      </button>
                      {o.status === 'Draft' && (
                        <button onClick={() => handleDelete(o)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </GlassCard>

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
const STATUS_CLASS: Record<ExportOrder['status'], string> = {
  Draft: 'bg-amber-100 text-amber-800',
  PendingApproval: 'bg-amber-100 text-amber-900',
  Approved: 'bg-sky-100 text-sky-800',
  Shipped: 'bg-sky-100 text-sky-900',
  Completed: 'bg-mint-100 text-mint-800',
  Cancelled: 'bg-red-100 text-red-700',
};

const StatusDropdown: React.FC<{
  status: ExportOrder['status'];
  isAdmin: boolean;
  onChange: (s: ExportOrder['status']) => void;
}> = ({ status, isAdmin, onChange }) => {
  const cls = STATUS_CLASS[status];

  // Terminal states
  if (status === 'Completed' || status === 'Cancelled') {
    return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{status}</span>;
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
    <div className="relative inline-block">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as ExportOrder['status'])}
        className={`appearance-none rounded-full py-1 pl-2.5 pr-7 text-xs font-bold cursor-pointer border-0 ${cls}`}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o === 'PendingApproval' ? 'Pending Approval' : o}</option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
    </div>
  );
};

export default ExportOrdersListPage;
