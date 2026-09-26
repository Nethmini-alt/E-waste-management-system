/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Search, Filter, Check, XCircle, RefreshCw,
} from 'lucide-react';
import { submissionApi } from './submissionApi';
import type { SubmissionResponse } from './types';

const AdminReviewPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [selectedHazard, setSelectedHazard] = useState<string>('All');

  // ---- Load ----
  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSubmissions(await submissionApi.list());
    } catch (e) {
      console.error(e);
      setError('Failed to fetch submissions.');
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ---- Approve / Reject ----
  const handleDecision = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await submissionApi.updateStatus(id, status);
      await load();
    } catch (e) {
      console.error(e);
      alert('Failed to update status.');
      await load();
    }
  };

  // ---- Filter ----
  const filtered = useMemo(() => {
    return submissions.filter((sub) => {
      const item = sub.items?.[0] || (sub as any).Items?.[0];
      const ai =
        sub.aiAnalysis ||
        (sub as any).aIAnalysis ||
        (sub as any).AiAnalysis;

      const desc = (item?.description || item?.Description || '').toLowerCase();
      const itemName = (item?.itemName || item?.ItemName || '').toLowerCase();
      const category = (ai?.wasteCategory || ai?.WasteCategory || '').toLowerCase();

      const matchesSearch =
        desc.includes(searchTerm.toLowerCase()) ||
        itemName.includes(searchTerm.toLowerCase()) ||
        category.includes(searchTerm.toLowerCase()) ||
        sub.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        selectedStatus === 'All' || sub.status === selectedStatus;

      const hazard = ai?.hazardLevel || ai?.HazardLevel || 'Unknown';
      const matchesHazard =
        selectedHazard === 'All' || hazard === selectedHazard;

      return matchesSearch && matchesStatus && matchesHazard;
    });
  }, [submissions, searchTerm, selectedStatus, selectedHazard]);

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <LayoutDashboard size={22} /> E-Waste Review Panel
          </h2>
          <p style={{ color: '#666', margin: '4px 0 0 0' }}>
            Review hazardous items flagged by the AI and approve/reject collection requests.
          </p>
        </div>
        <button onClick={load} style={btnSecondary}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Search + Filters */}
      <div style={filterBar}>
        <div style={searchBox}>
          <Search size={18} color="#888" />
          <input
            type="text"
            placeholder="Search by description, ID or category…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={searchInput}
          />
        </div>

        <div style={filterGroup}>
          <Filter size={16} color="#555" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            style={select}
          >
            <option value="All">All Statuses</option>
            <option value="Pending_Approval">Pending Approval</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </select>
        </div>

        <select
          value={selectedHazard}
          onChange={(e) => setSelectedHazard(e.target.value)}
          style={select}
        >
          <option value="All">All Hazard Levels</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
          <option value="Critical">Critical</option>
        </select>
      </div>

      {/* States */}
      {loading && <p>Loading submissions…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && filtered.length === 0 && (
        <div style={emptyBox}>
          <LayoutDashboard size={36} color="#bbb" />
          <p>No submissions matched your criteria.</p>
        </div>
      )}

      {/* List */}
      {!loading && !error && filtered.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
          {filtered.map((sub) => {
            const item = sub.items?.[0] || (sub as any).Items?.[0];
            const ai =
              sub.aiAnalysis ||
              (sub as any).aIAnalysis ||
              (sub as any).AiAnalysis;

            const imgUrl = item?.imageUrl || item?.ImageUrl || item?.image_url;
            const hazard = ai?.hazardLevel || ai?.HazardLevel;
            const category = ai?.wasteCategory || ai?.WasteCategory;
            const value = ai?.estimatedValueUsd ?? ai?.EstimatedValueUsd;

            return (
              <div key={sub.id} style={card}>
                {/* Image */}
                <div style={imgWrap}>
                  {imgUrl ? (
                    <img
                      src={imgUrl}
                      alt={item?.itemName || 'E-Waste'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).onerror = null;
                        (e.target as HTMLImageElement).src =
                          'https://placehold.co/100x100?text=E-Waste';
                      }}
                    />
                  ) : (
                    <span style={{ fontSize: 11, color: '#888' }}>No Image</span>
                  )}
                </div>

                {/* Body */}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h4 style={{ margin: '0 0 5px 0' }}>
                      {item?.itemName || item?.ItemName || 'E-Waste Item'}
                    </h4>
                    <span style={idBadge}>ID: {sub.id.substring(0, 8)}…</span>
                  </div>

                  <p style={{ margin: '0 0 8px 0', color: '#555', fontSize: 14 }}>
                    "{item?.description || item?.Description}"
                  </p>

                  {ai ? (
                    <div style={aiBox}>
                      <span><strong>Category:</strong> {category}</span>
                      <span>
                        <strong>Hazard:</strong>{' '}
                        <span
                          style={{
                            color:
                              hazard === 'High' || hazard === 'Critical'
                                ? 'red'
                                : 'green',
                            fontWeight: 'bold',
                          }}
                        >
                          {hazard}
                        </span>
                      </span>
                      <span><strong>Value:</strong> ${value}</span>
                    </div>
                  ) : (
                    <span style={{ fontSize: 12, color: '#e65100' }}>
                      Pending AI Analysis…
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div style={actionsCol}>
                  <span style={statusBadge(sub.status)}>{sub.status}</span>

                  <div style={{ display: 'flex', gap: 5 }}>
                    <button
                      onClick={() => handleDecision(sub.id, 'Approved')}
                      style={btnApprove}
                    >
                      <Check size={14} /> Approve
                    </button>
                    <button
                      onClick={() => handleDecision(sub.id, 'Rejected')}
                      style={btnReject}
                    >
                      <XCircle size={14} /> Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ---------- Styles ----------
const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 15,
  display: 'flex',
  gap: 15,
  alignItems: 'center',
};

const imgWrap: React.CSSProperties = {
  width: 100,
  height: 100,
  borderRadius: 6,
  overflow: 'hidden',
  background: '#f5f5f5',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  border: '1px solid #eee',
};

const idBadge: React.CSSProperties = {
  fontSize: 12,
  background: '#eee',
  padding: '3px 8px',
  borderRadius: 4,
};

const aiBox: React.CSSProperties = {
  fontSize: 13,
  background: '#f5f5f5',
  padding: 8,
  borderRadius: 4,
  display: 'flex',
  gap: 15,
  flexWrap: 'wrap',
};

const actionsCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  alignItems: 'flex-end',
};

const filterBar: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginBottom: 20,
  flexWrap: 'wrap',
  background: '#f5f5f5',
  padding: 12,
  borderRadius: 8,
};

const searchBox: React.CSSProperties = {
  flex: 2,
  minWidth: 200,
  display: 'flex',
  alignItems: 'center',
  background: '#fff',
  border: '1px solid #ccc',
  borderRadius: 4,
  padding: '0 8px',
};

const searchInput: React.CSSProperties = {
  border: 'none',
  padding: 8,
  width: '100%',
  outline: 'none',
};

const filterGroup: React.CSSProperties = {
  flex: 1,
  minWidth: 140,
  display: 'flex',
  alignItems: 'center',
  gap: 5,
};

const select: React.CSSProperties = {
  width: '100%',
  padding: 8,
  borderRadius: 4,
  border: '1px solid #ccc',
};

const btnSecondary: React.CSSProperties = {
  background: '#eee',
  color: '#333',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const btnApprove: React.CSSProperties = {
  background: '#2e7d32',
  color: '#fff',
  border: 'none',
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
};

const btnReject: React.CSSProperties = {
  background: '#c62828',
  color: '#fff',
  border: 'none',
  padding: '6px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
};

const errorBox: React.CSSProperties = {
  padding: 12,
  background: '#ffebee',
  color: '#c62828',
  borderRadius: 6,
};

const emptyBox: React.CSSProperties = {
  padding: 40,
  background: '#fff',
  borderRadius: 8,
  textAlign: 'center',
  color: '#888',
  border: '1px dashed #ccc',
};

const statusBadge = (status: string): React.CSSProperties => ({
  fontWeight: 'bold',
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 12,
  background:
    status === 'Approved'
      ? '#e8f5e9'
      : status === 'Rejected'
      ? '#ffebee'
      : '#fff3e0',
  color:
    status === 'Approved'
      ? '#2e7d32'
      : status === 'Rejected'
      ? '#c62828'
      : '#e65100',
});

export default AdminReviewPage;