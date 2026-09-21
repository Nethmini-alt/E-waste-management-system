/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Pencil, Trash2, RefreshCw, Users } from 'lucide-react';
import { buyerApi } from './buyerApi';
import type { Buyer, CreateBuyerRequest } from './types';
import BuyerFormModal from './BuyerFormModal';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={22} /> Buyers
        </h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnSecondary}><RefreshCw size={14} /> Refresh</button>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            style={btnPrimary}
          >
            <Plus size={14} /> New Buyer
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 15 }}>
        <div style={searchBox}>
          <Search size={16} color="#888" />
          <input
            placeholder="Search company, contact or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={searchInput}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          style={{ padding: 8, borderRadius: 6, border: '1px solid #ccc' }}
        >
          <option value="All">All Statuses</option>
          <option value="Pending">Pending</option>
          <option value="Active">Active</option>
          <option value="Suspended">Suspended</option>
        </select>
      </div>

      {loading && <p>Loading buyers…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={emptyBox}>
          <Users size={40} color="#bbb" />
          <p>No buyers found. Click <strong>New Buyer</strong> to add one.</p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={th}>Company</th>
              <th style={th}>Contact</th>
              <th style={th}>Email</th>
              <th style={th}>Type</th>
              <th style={th}>Status</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b) => (
              <tr key={b.buyerId} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>{b.companyName}</td>
                <td style={td}>{b.contactPerson}</td>
                <td style={td}>{b.email}</td>
                <td style={td}>{b.buyerType}</td>
                <td style={td}>
                  <select
                    value={b.status}
                    onChange={(e) => changeStatus(b, e.target.value as any)}
                    style={{
                      padding: 4, borderRadius: 4, border: '1px solid #ccc',
                      background: statusBg(b.status), fontWeight: 'bold', fontSize: 12,
                    }}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </td>
                <td style={td}>
                  <button
                    onClick={() => { setEditing(b); setModalOpen(true); }}
                    style={iconBtn}
                    title="Edit"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(b)}
                    style={{ ...iconBtn, color: '#c62828' }}
                    title="Delete"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

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

const statusBg = (s: Buyer['status']) =>
  s === 'Active' ? '#e8f5e9' : s === 'Suspended' ? '#ffebee' : '#fff3e0';

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
const searchInput: React.CSSProperties = {
  flex: 1, border: 'none', outline: 'none', padding: 8,
};
const errorBox: React.CSSProperties = {
  padding: 12, background: '#ffebee', color: '#c62828', borderRadius: 6,
};
const emptyBox: React.CSSProperties = {
  padding: 40, background: '#fff', borderRadius: 8, textAlign: 'center', color: '#888',
  border: '1px dashed #ccc',
};

export default BuyersListPage;