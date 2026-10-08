/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, Pencil, Trash2, RefreshCw, Tag, CheckCircle2, Clock,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { pricingApi } from './pricingApi';
import type { MaterialPricing } from './types';
import MaterialPricingFormModal, {
  type MaterialPricingFormValues,
} from './MaterialPricingFormModal';
import {
  EmptyState, ErrorMessage, GlassCard, PageHeader,
  btnPrimary, btnSecondary, inputClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';

const MaterialPricingListPage: React.FC = () => {
  // Staff can read the price list; only an admin adds, edits, approves or expires prices.
  const { user } = useAuth() as unknown as { user: { role: string } | null };
  const isAdmin = user?.role.toLowerCase() === 'admin';

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

  // A row can still read "Approved" for a few hours after its expiry date until the server's
  // background sweep runs (that sweep is what keeps stored status honest — orders never use
  // expired-by-date rows either way). This lets staff force it and see the result immediately.
  const handleExpireStale = async () => {
    try {
      const { expired } = await pricingApi.expireStale();
      await load();
      alert(
        expired === 0
          ? 'No approved prices are past their expiry date.'
          : `Marked ${expired} price(s) Expired.`
      );
    } catch (e: any) {
      alert(
        e?.response?.data?.detail ??
          e?.response?.data?.title ??
          'Failed to expire past prices.'
      );
    }
  };

  return (
    <div>
      <PageHeader
        title="Selling prices"
        subtitle={isAdmin ? undefined : 'What buyers pay per kilogram. Only an admin can add or change prices.'}
        icon={Tag}
        actions={
          <>
            <button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            {isAdmin && (
              <>
                <button onClick={handleExpireStale} className={btnSecondary} title="Mark every approved price whose expiry date has passed as Expired">
                  <Clock size={14} /> Expire past dates
                </button>
                <button onClick={() => { setEditing(null); setModalOpen(true); }} className={btnPrimary}>
                  <Plus size={14} /> New price
                </button>
              </>
            )}
          </>
        }
      />

      <GlassCard hover={false} className="mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
            <input
              placeholder="Search material or author…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)} className={`${inputClass} !w-auto`}>
            <option value="All">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Approved">Approved</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </GlassCard>

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !rows.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-600">Loading pricing…</p>
        ) : !error && filtered.length === 0 ? (
          <EmptyState
            icon={Tag}
            title="No pricing rows found"
            description={isAdmin ? 'Click "New price" to add one.' : 'No prices have been added yet.'}
          />
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Material</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Price / kg</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Effective</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Expiry</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Created by</th>
                  {isAdmin && <th className={`${tableHeadClass} px-4 py-3`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.pricingId} className="border-b border-mint-50 last:border-0">
                    <td className={`${tableCellClass} font-semibold text-ink-900`}>{p.materialType}</td>
                    <td className={tableCellClass}>Rs. {p.pricePerKg.toFixed(2)}</td>
                    <td className={tableCellClass}>{p.effectiveDate}</td>
                    <td className={tableCellClass}>{p.expiryDate ?? '—'}</td>
                    <td className={tableCellClass}>
                      <StatusPill status={p.status} />
                      {p.status === 'Approved' && !p.isLive && (
                        <div className="mt-1 text-[11px] font-bold text-amber-700" title="The expiry date has passed, so orders cannot use this price. Mark it Expired (or let the background sweep do it).">
                          expiry passed
                        </div>
                      )}
                    </td>
                    <td className={`${tableCellClass} text-ink-600`}>{p.createdByName || '—'}</td>
                    {isAdmin && (
                      <td className={tableCellClass}>
                        {p.status === 'Draft' && (
                          <button onClick={() => handleStatusChange(p, 'Approved')} className="mr-1 rounded-lg p-1.5 text-mint-700 hover:bg-mint-50" title="Approve">
                            <CheckCircle2 size={16} />
                          </button>
                        )}
                        {p.status === 'Approved' && (
                          <button onClick={() => handleStatusChange(p, 'Expired')} className="mr-1 rounded-lg p-1.5 text-amber-700 hover:bg-amber-50" title="Mark expired">
                            <Clock size={16} />
                          </button>
                        )}
                        <button onClick={() => { setEditing(p); setModalOpen(true); }} className="mr-1 rounded-lg p-1.5 text-ink-700 hover:bg-mint-50" title="Edit">
                          <Pencil size={16} />
                        </button>
                        {p.status === 'Draft' && (
                          <button onClick={() => handleDelete(p)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Delete">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </GlassCard>

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
  const cls = status === 'Approved' ? 'bg-mint-100 text-mint-800' : status === 'Expired' ? 'bg-ink-100 text-ink-700' : 'bg-amber-100 text-amber-800';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{status}</span>;
};

export default MaterialPricingListPage;
