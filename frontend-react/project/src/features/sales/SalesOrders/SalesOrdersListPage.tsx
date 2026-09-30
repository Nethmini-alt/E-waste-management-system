/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Plus, Search, RefreshCw, ShoppingCart, Eye, Trash2, ChevronDown,
} from 'lucide-react';
import { salesOrderApi } from './salesOrderApi';
import type { SalesOrder, CreateSalesOrderRequest } from './types';
import SalesOrderFormModal from './SalesOrderFormModal';
import SalesOrderDetailModal from './SalesOrderDetailModal';
import { buyerApi } from '../Buyers/buyerApi';
import type { Buyer } from '../Buyers/types';
import {
  EmptyState, ErrorMessage, GlassCard, PageHeader,
  btnPrimary, btnSecondary, inputClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';

const SalesOrdersListPage: React.FC = () => {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | SalesOrder['status']>('All');
  const [buyerFilter, setBuyerFilter] = useState<string>('');

  // "?new=1" (e.g. from Material stock) opens the new-order form straight away.
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(params.get('new') === '1');
  useEffect(() => {
    if (params.has('new')) setParams({}, { replace: true });
  }, [params, setParams]);
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
      <PageHeader
        title="Sales orders"
        icon={ShoppingCart}
        actions={
          <>
            <button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            <button onClick={() => setCreateOpen(true)} className={btnPrimary}><Plus size={14} /> New order</button>
          </>
        }
      />

      <GlassCard hover={false} className="mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
            <input
              placeholder="Search buyer or order ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={`${inputClass} !w-auto`}>
            <option value="All">All statuses</option>
            <option value="WaitingForStock">Waiting for stock</option>
            <option value="WaitingForPrice">Waiting for price</option>
            <option value="PendingPlanApproval">Plan approval</option>
            <option value="Draft">Draft</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <select value={buyerFilter} onChange={(e) => setBuyerFilter(e.target.value)} className={`${inputClass} !w-auto`}>
            <option value="">All buyers</option>
            {buyers.map((b) => (
              <option key={b.buyerId} value={b.buyerId}>{b.companyName}</option>
            ))}
          </select>
        </div>
      </GlassCard>

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !orders.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-600">Loading orders…</p>
        ) : !error && filtered.length === 0 ? (
          <EmptyState icon={ShoppingCart} title="No orders match your filters" description='Click "New order" to create one.' />
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Order</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Buyer</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Date</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Items</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Total</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Plan</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <tr key={o.salesOrderId} className="border-b border-mint-50 last:border-0">
                    <td className={`${tableCellClass} font-mono text-xs`}>{o.salesOrderId.slice(0, 8)}…</td>
                    <td className={`${tableCellClass} font-semibold text-ink-900`}>{o.buyerCompanyName}</td>
                    <td className={`${tableCellClass} text-ink-600`}>{new Date(o.orderDate).toLocaleDateString()}</td>
                    <td className={tableCellClass}>
                      {o.items.length > 0
                        ? o.items.map((item) => `${item.materialType} (${item.quantityKg.toLocaleString()} kg)`).join(', ')
                        : `${o.pendingMaterialType ?? 'Material'} (${(o.pendingQuantityKg ?? 0).toLocaleString()} kg)`}
                    </td>
                    <td className={`${tableCellClass} text-right font-bold`}>Rs. {o.totalAmount.toFixed(2)}</td>
                    <td className={tableCellClass}>
                      <StatusDropdown status={o.status} materialRequestStatus={o.materialRequestStatus} onChange={(s) => handleStatusChange(o, s)} />
                    </td>
                    <td className={tableCellClass}>
                      {o.commercialPlanId
                        ? <Link to={`/plans/${o.commercialPlanId}`} className="font-semibold text-mint-700 hover:underline">Review plan</Link>
                        : o.materialRequestNote ?? (o.status === 'WaitingForStock'
                          ? 'Waiting for stock'
                          : o.status === 'WaitingForPrice' ? 'Waiting for approved price' : '—')}
                    </td>
                    <td className={tableCellClass}>
                      <button onClick={() => setDetailOrder(o)} className="mr-1 rounded-lg p-1.5 text-ink-700 hover:bg-mint-50" title="View">
                        <Eye size={16} />
                      </button>
                      {o.status === 'Draft' && !o.materialRequestId && (
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
const STATUS_CLASS: Record<SalesOrder['status'], string> = {
  WaitingForStock: 'bg-amber-100 text-amber-800',
  WaitingForPrice: 'bg-red-100 text-red-700',
  PendingPlanApproval: 'bg-sky-100 text-sky-800',
  Draft: 'bg-amber-100 text-amber-800',
  Confirmed: 'bg-sky-100 text-sky-800',
  Completed: 'bg-mint-100 text-mint-800',
  Cancelled: 'bg-red-100 text-red-700',
};

const StatusDropdown: React.FC<{
  status: SalesOrder['status'];
  materialRequestStatus?: SalesOrder['materialRequestStatus'];
  onChange: (s: SalesOrder['status']) => void;
}> = ({ status, materialRequestStatus, onChange }) => {
  const cls = STATUS_CLASS[status];

  const requestStatusLabels: Partial<Record<NonNullable<SalesOrder['materialRequestStatus']>, string>> = {
    Waiting: 'Waiting for stock',
    WaitingForPrice: 'Waiting for approved price',
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
  if (status === 'WaitingForStock' || status === 'WaitingForPrice' || status === 'PendingPlanApproval' || status === 'Completed' || status === 'Cancelled') {
    return <span className={`rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap ${cls}`}>{displayStatus}</span>;
  }

  const options: SalesOrder['status'][] = status === 'Draft'
    ? ['Draft', 'Confirmed', 'Cancelled']
    : ['Confirmed', 'Completed', 'Cancelled'];

  return (
    <div className="relative inline-block">
      <select
        value={status}
        onChange={(e) => onChange(e.target.value as SalesOrder['status'])}
        className={`appearance-none rounded-full py-1 pl-2.5 pr-7 text-xs font-bold cursor-pointer border-0 ${cls}`}
      >
        {options.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
      <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
    </div>
  );
};

export default SalesOrdersListPage;
