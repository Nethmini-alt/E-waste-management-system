/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, RefreshCw } from 'lucide-react';
import { materialRequestApi } from './materialRequestApi';
import type { MaterialRequest } from './types';

const MaterialRequestManagementPage: React.FC = () => {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await materialRequestApi.listAll());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Could not load buyer requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><ClipboardList size={22} /> Buyer material demand</h2>
          <p style={{ color: '#65716b', margin: '6px 0 0' }}>Track backordered demand and open generated plans for admin review.</p>
        </div>
        <button onClick={() => void load()} style={refreshButton} title="Refresh requests" aria-label="Refresh requests"><RefreshCw size={15} /></button>
      </header>
      {error && <p role="alert" style={{ color: '#a33' }}>{error}</p>}
      {loading ? <p>Loading requests…</p> : requests.length === 0 ? <div style={emptyStyle}>No buyer requests have been submitted.</div> : (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #dce7e0', borderRadius: 8 }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Buyer</th><th style={thStyle}>Material</th><th style={thStyle}>Quantity</th><th style={thStyle}>Status</th><th style={thStyle}>Submitted</th><th style={thStyle}>Plan review</th></tr></thead>
            <tbody>{requests.map((request) => (
              <tr key={request.materialRequestId}>
                <td style={tdStyle}>{request.buyerCompanyName}</td>
                <td style={tdStyle}><strong>{request.materialType}</strong></td>
                <td style={tdStyle}>{request.quantityKg.toLocaleString()} kg</td>
                <td style={tdStyle}><span style={statusStyle}>{statusLabel(request.status)}</span></td>
                <td style={tdStyle}>{new Date(request.createdAt).toLocaleString()}</td>
                <td style={tdStyle}>{request.commercialPlanId ? <Link to={`/plans/${request.commercialPlanId}`}>Review plan</Link> : '—'}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const refreshButton: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 36, height: 36, border: '1px solid #cbd8d0', borderRadius: 5, background: '#fff', cursor: 'pointer' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 };
const thStyle: React.CSSProperties = { padding: '11px 12px', background: '#f4f8f5', color: '#58645d', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #dce7e0' };
const tdStyle: React.CSSProperties = { padding: 12, borderBottom: '1px solid #edf1ee' };
const statusStyle: React.CSSProperties = { padding: '4px 7px', background: '#edf3ef', borderRadius: 4, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' };
const emptyStyle: React.CSSProperties = { padding: 28, background: '#fff', border: '1px dashed #cbd8d0', borderRadius: 8, color: '#65716b', textAlign: 'center' };

const statusLabel = (status: MaterialRequest['status']) => ({
  Waiting: 'Waiting for stock',
  GeneratingPlan: 'Preparing plan',
  PlanGenerated: 'Awaiting admin approval',
  PlanGenerationFailed: 'Plan generation retrying',
  OrderPlaced: 'Order placed',
  Fulfilled: 'Fulfilled',
  Cancelled: 'Cancelled',
})[status];

export default MaterialRequestManagementPage;