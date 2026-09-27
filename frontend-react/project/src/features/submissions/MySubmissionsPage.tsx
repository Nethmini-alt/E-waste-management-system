import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, RefreshCw, Send, Truck } from 'lucide-react';
import { submissionApi } from './submissionApi';
import { extractGeneralError } from './submissionErrors';
import type { SubmissionResponse } from './types';

const GOOD_STATUSES = ['CollectorAssigned', 'Collected'];
const BAD_STATUSES = ['Rejected', 'Failed', 'Cancelled'];

const MySubmissionsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSubmissions(await submissionApi.mine());
    } catch (e) {
      setError(extractGeneralError(e));
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PackageSearch size={22} /> My Submissions
          </h2>
          <p style={{ color: '#666', margin: '4px 0 0 0' }}>
            Track the e-waste items you've submitted for collection.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={load} style={btnSecondary}>
            <RefreshCw size={14} /> Refresh
          </button>
          <Link to="/submissions/new" style={btnPrimary}>
            <Send size={14} /> Submit New Item
          </Link>
        </div>
      </div>

      {loading && <p>Loading…</p>}
      {error && <div style={errorBox}>{error}</div>}

      {!loading && !error && submissions.length === 0 && (
        <div style={emptyBox}>
          <PackageSearch size={36} color="#bbb" />
          <p>You haven't submitted any items yet.</p>
          <Link to="/submissions/new" style={btnPrimary}>
            <Send size={14} /> Submit your first item
          </Link>
        </div>
      )}

      {!loading && !error && submissions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {submissions.map((sub) => (
            <div key={sub.id} style={card}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ margin: '0 0 5px 0' }}>{sub.category}</h4>
                  <span style={idBadge}>ID: {sub.id.substring(0, 8)}…</span>
                </div>
                <p style={{ margin: '0 0 6px 0', color: '#555', fontSize: 14 }}>{sub.pickupAddress}</p>
                <p style={{ margin: 0, fontSize: 12, color: '#888' }}>
                  {sub.items.length} item{sub.items.length === 1 ? '' : 's'} · Submitted{' '}
                  {new Date(sub.createdAt).toLocaleDateString()}
                </p>
                {sub.statusReason && (
                  <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#c62828' }}>{sub.statusReason}</p>
                )}
              </div>

              <div style={actionsCol}>
                <span style={statusBadge(sub.status)}>{sub.statusLabel}</span>
                {/* No submitter-facing job detail page exists yet (job detail
                    is Staff/Admin-only), so the job is surfaced as info here
                    rather than a link that would just redirect away. */}
                {sub.jobId && (
                  <span style={jobInfo}>
                    <Truck size={13} /> Job #{sub.jobId.substring(0, 8)}… — {sub.jobStatus}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const card: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 8,
  padding: 15,
  display: 'flex',
  gap: 15,
  alignItems: 'center',
};

const idBadge: React.CSSProperties = {
  fontSize: 12,
  background: '#eee',
  padding: '3px 8px',
  borderRadius: 4,
};

const actionsCol: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  alignItems: 'flex-end',
};

const jobInfo: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 5,
  fontSize: 12,
  color: '#555',
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

const btnPrimary: React.CSSProperties = {
  background: '#2e7d32',
  color: '#fff',
  border: 'none',
  padding: '8px 14px',
  borderRadius: 6,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  textDecoration: 'none',
  fontSize: 14,
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
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 10,
};

const GOOD_BG = '#e8f5e9', GOOD_FG = '#2e7d32', BAD_BG = '#ffebee', BAD_FG = '#c62828', NEUTRAL_BG = '#fff3e0', NEUTRAL_FG = '#e65100';

const statusBadge = (status: string): React.CSSProperties => ({
  fontWeight: 'bold',
  padding: '4px 10px',
  borderRadius: 4,
  fontSize: 12,
  whiteSpace: 'nowrap',
  background: GOOD_STATUSES.includes(status) ? GOOD_BG : BAD_STATUSES.includes(status) ? BAD_BG : NEUTRAL_BG,
  color: GOOD_STATUSES.includes(status) ? GOOD_FG : BAD_STATUSES.includes(status) ? BAD_FG : NEUTRAL_FG,
});

export default MySubmissionsPage;
