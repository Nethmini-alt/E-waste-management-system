/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, Users } from 'lucide-react';
import { buyerApi } from './buyerApi';
import type { Buyer, CreateBuyerRequest } from './types';
import BuyerFormModal from './BuyerFormModal';
import {
  EmptyState, ErrorMessage, GlassCard, PageHeader,
  btnPrimary, btnSecondary, inputClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';

const BuyersListPage: React.FC = () => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | Buyer['status']>('All');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Buyer | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setBuyers(await buyerApi.list());
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load buyers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return buyers.filter((b) => {
      const matchesSearch =
        b.companyName.toLowerCase().includes(q) ||
        b.contactPerson.toLowerCase().includes(q) ||
        b.email.toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [buyers, search, statusFilter]);

  const handleCreate = async (values: CreateBuyerRequest) => {
    try {
      await buyerApi.create(values);
      setModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.title ?? 'Failed to create buyer.');
    }
  };

  const handleUpdate = async (values: any) => {
    if (!editing) return;
    try {
      await buyerApi.update(editing.buyerId, { ...values, status: editing.status });
      setEditing(null);
      setModalOpen(false);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.title ?? 'Failed to update buyer.');
    }
  };

  const handleDelete = async (b: Buyer) => {
    if (!confirm(`Delete buyer "${b.companyName}"?`)) return;
    try {
      await buyerApi.remove(b.buyerId);
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.title ?? 'Failed to delete buyer.');
    }
  };

  const changeStatus = async (b: Buyer, status: Buyer['status']) => {
    try {
      await buyerApi.update(b.buyerId, {
        companyName: b.companyName,
        contactPerson: b.contactPerson,
        email: b.email,
        phoneNumber: b.phoneNumber,
        address: b.address,
        buyerType: b.buyerType,
        status,
      });
      await load();
    } catch (e: any) {
      alert(e?.response?.data?.title ?? 'Failed to change status.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Buyers"
        icon={Users}
        actions={
          <>
            <button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
            <button onClick={() => { setEditing(null); setModalOpen(true); }} className={btnPrimary}>
              <Plus size={14} /> New buyer
            </button>
          </>
        }
      />

      <GlassCard hover={false} className="mb-4">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
            <input
              placeholder="Search company, contact or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className={`${inputClass} !w-auto`}
          >
            <option value="All">All statuses</option>
            <option value="Pending">Pending</option>
            <option value="Active">Active</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>
      </GlassCard>

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !buyers.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-600">Loading buyers…</p>
        ) : !error && filtered.length === 0 ? (
          <EmptyState icon={Users} title="No buyers found" description='Click "New buyer" to add one.' />
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Company</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Contact</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Email</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Type</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((b) => (
                  <tr key={b.buyerId} className="border-b border-mint-50 last:border-0">
                    <td className={`${tableCellClass} font-semibold text-ink-900`}>{b.companyName}</td>
                    <td className={tableCellClass}>{b.contactPerson}</td>
                    <td className={tableCellClass}>{b.email}</td>
                    <td className={tableCellClass}>{b.buyerType}</td>
                    <td className={tableCellClass}>
                      <select
                        value={b.status}
                        onChange={(e) => changeStatus(b, e.target.value as any)}
                        className={`rounded-lg border-0 px-2.5 py-1 text-xs font-bold ${statusPillClass(b.status)}`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Active">Active</option>
                        <option value="Suspended">Suspended</option>
                      </select>
                    </td>
                    <td className={tableCellClass}>
                      <button onClick={() => { setEditing(b); setModalOpen(true); }} className="mr-1 rounded-lg p-1.5 text-ink-700 hover:bg-mint-50" title="Edit">
                        <Pencil size={16} />
                      </button>
                      <button onClick={() => handleDelete(b)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50" title="Delete">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </GlassCard>

      <BuyerFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSubmit={editing ? handleUpdate : handleCreate}
        initial={editing ? {
          userId: editing.userId,
          companyName: editing.companyName,
          contactPerson: editing.contactPerson,
          email: editing.email,
          phoneNumber: editing.phoneNumber ?? '',
          address: editing.address ?? '',
          buyerType: editing.buyerType,
        } : undefined}
        title={editing ? 'Edit Buyer' : 'New Buyer'}
      />
    </div>
  );
};

const statusPillClass = (s: Buyer['status']) =>
  s === 'Active' ? 'bg-mint-100 text-mint-800' : s === 'Suspended' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800';

export default BuyersListPage;
