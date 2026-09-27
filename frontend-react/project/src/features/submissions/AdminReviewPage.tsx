/* eslint-disable react-hooks/set-state-in-effect */
import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard, Search, Filter, RefreshCw, ExternalLink,
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

  // ---- Filter ----
  // Approve/reject happens in Agentic Review (it resumes or stops the agent
  // chain); this page only shows where each submission is.
  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return submissions.filter((sub) => {
      const item = sub.items[0];
      const ai = sub.workflow?.analysis;

      const matchesSearch =
        (item?.description ?? '').toLowerCase().includes(term) ||
        (item?.itemName ?? '').toLowerCase().includes(term) ||
        (ai?.wasteCategory ?? '').toLowerCase().includes(term) ||
        sub.id.toLowerCase().includes(term);

      const matchesStatus =
        selectedStatus === 'All' || sub.status === selectedStatus;

      const hazard = ai?.hazardLevel ?? 'Unknown';
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
            Track every submission. Items flagged by the AI are approved or rejected in Agentic Review.
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
            <option value="Analyzing">Analyzing</option>
            <option value="AwaitingReview">Awaiting review</option>
            <option value="Scheduling">Scheduling</option>
            <option value="CollectorAssigned">Collector assigned</option>
            <option value="AwaitingCollector">Awaiting collector</option>
            <option value="Collected">Collected</option>
            <option value="Rejected">Rejected</option>
            <option value="Failed">Failed</option>
            <option value="Closed">Closed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="NotProcessed">Not processed</option>
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
            const item = sub.items[0];
            const ai = sub.workflow?.analysis;

            const imgUrl = item?.imageUrl;
            const hazard = ai?.hazardLevel;
            const category = ai?.wasteCategory;
            const value = ai?.estimatedValueUsd;

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
                      {item?.itemName || 'E-Waste Item'}
                    </h4>
                    <span style={idBadge}>ID: {sub.id.substring(0, 8)}…</span>
                  </div>

                  <p style={{ margin: '0 0 8px 0', color: '#555', fontSize: 14 }}>
                    "{item?.description}"
                  </p>
                  {sub.statusReason && (
                    <p style={{ margin: '0 0 8px 0', color: '#c62828', fontSize: 13 }}>
                      {sub.statusReason}
                    </p>
                  )}

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
                  ) : sub.status === 'Analyzing' ? (
                    <span style={{ fontSize: 12, color: '#e65100' }}>
                      Pending AI Analysis…
                    </span>
                  ) : null}
                </div>

                {/* Status */}
                <div style={actionsCol}>
                  <span style={statusBadge(sub.status)}>{sub.statusLabel}</span>

                  {sub.status === 'AwaitingReview' && (
                    <Link to="/processing/agentic-review" style={btnReview}>
                      <ExternalLink size={14} /> Review in Agentic Review
                    </Link>
                  )}
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

const btnReview: React.CSSProperties = {
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
  textDecoration: 'none',
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

const GOOD_STATUSES = ['CollectorAssigned', 'Collected'];
const BAD_STATUSES = ['Rejected', 'Failed', 'Cancelled'];

const statusBadge = (status: string): React.CSSProperties => ({
  fontWeight: 'bold',
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 12,
  background: GOOD_STATUSES.includes(status)
    ? '#e8f5e9'
    : BAD_STATUSES.includes(status)
    ? '#ffebee'
    : '#fff3e0',
  color: GOOD_STATUSES.includes(status)
    ? '#2e7d32'
    : BAD_STATUSES.includes(status)
    ? '#c62828'
    : '#e65100',
});

export default AdminReviewPage;