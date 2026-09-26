/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import { AlertCircle, Clock3, PackagePlus, RefreshCw, X } from 'lucide-react';
import { materialRequestApi } from './materialRequestApi';
import type { MaterialRequest } from './types';

const MaterialRequestsPage: React.FC = () => {
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [materialType, setMaterialType] = useState('');
  const [quantityKg, setQuantityKg] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await materialRequestApi.listMine());
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Could not load your material requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await materialRequestApi.create({ materialType: materialType.trim(), quantityKg: Number(quantityKg) });
      setMaterialType('');
      setQuantityKg('');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Could not submit your request.');
    } finally {
      setSaving(false);
    }
  };

  const cancel = async (request: MaterialRequest) => {
    try {
      await materialRequestApi.cancel(request.materialRequestId);
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Could not cancel this request.');
    }
  };

  return (
    <div style={{ maxWidth: 980, margin: '0 auto' }}>
      <header style={headerStyle}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 9 }}><PackagePlus size={22} /> Material requests</h2>
          <p style={{ color: '#65716b', margin: '6px 0 0' }}>Request material even when stock is not available. We will prepare a sales plan when it is restocked.</p>
        </div>
        <button onClick={() => void load()} style={secondaryButton} title="Refresh requests" aria-label="Refresh requests"><RefreshCw size={15} /></button>
      </header>

      {error && <div style={errorStyle}><AlertCircle size={16} /> {error}</div>}

      <form onSubmit={submit} style={formStyle}>
        <label style={fieldStyle}>
          Material type
          <input value={materialType} onChange={(event) => setMaterialType(event.target.value)} maxLength={100} placeholder="e.g. Copper" required style={inputStyle} />
        </label>
        <label style={fieldStyle}>
          Quantity (kg)
          <input type="number" min="0.001" max="1000000" step="0.001" value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} required style={inputStyle} />
        </label>
        <button type="submit" disabled={saving} style={submitButton}><PackagePlus size={15} /> {saving ? 'Submitting…' : 'Request material'}</button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '28px 0 10px' }}>
        <h3 style={{ margin: 0, fontSize: 17 }}>Your requests</h3>
        <span style={{ color: '#65716b', fontSize: 13 }}>{requests.length} total</span>
      </div>

      {loading ? <p>Loading requests…</p> : requests.length === 0 ? (
        <div style={emptyStyle}>No material requests yet.</div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #dce7e0', borderRadius: 8 }}>
          <table style={tableStyle}>
            <thead><tr><th style={thStyle}>Material</th><th style={thStyle}>Quantity</th><th style={thStyle}>Status</th><th style={thStyle}>Requested</th><th style={thStyle}>Plan</th><th style={thStyle}></th></tr></thead>
            <tbody>{requests.map((request) => (
              <tr key={request.materialRequestId}>
                <td style={tdStyle}><strong>{request.materialType}</strong></td>
                <td style={tdStyle}>{request.quantityKg.toLocaleString()} kg</td>
                <td style={tdStyle}><Status status={request.status} /></td>
                <td style={tdStyle}>{new Date(request.createdAt).toLocaleDateString()}</td>
                <td style={tdStyle}>{request.commercialPlanId ? 'Awaiting admin review' : request.status === 'PlanGenerationFailed' ? 'Retry scheduled' : '—'}</td>
                <td style={tdStyle}>{['Waiting', 'PlanGenerationFailed'].includes(request.status) && <button onClick={() => void cancel(request)} style={iconButton} title="Cancel request" aria-label="Cancel request"><X size={16} /></button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const Status: React.FC<{ status: MaterialRequest['status'] }> = ({ status }) => {
  const tones: Record<MaterialRequest['status'], [string, string]> = {
    Waiting: ['#fff5dc', '#805b00'],
    GeneratingPlan: ['#e8f2ff', '#175d9b'],
    PlanGenerated: ['#e5f5eb', '#21683a'],
    PlanGenerationFailed: ['#fff0ef', '#9d322a'],
    OrderPlaced: ['#e5f5eb', '#21683a'],
    Fulfilled: ['#e5f5eb', '#21683a'],
    Cancelled: ['#f1f2f1', '#626963'],
  };
  const label = status === 'GeneratingPlan'
    ? 'Preparing plan'
    : status === 'PlanGenerationFailed'
      ? 'Plan generation retrying'
      : status === 'PlanGenerated'
        ? 'Awaiting admin approval'
        : status === 'OrderPlaced'
          ? 'Order placed'
          : status;
  return <span style={{ ...statusStyle, background: tones[status][0], color: tones[status][1] }}><Clock3 size={12} /> {label}</span>;
};

const headerStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 22 };
const formStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) minmax(150px, 220px) auto', alignItems: 'end', gap: 14, padding: 18, background: '#fff', border: '1px solid #dce7e0', borderRadius: 8 };
const fieldStyle: React.CSSProperties = { display: 'grid', gap: 6, fontSize: 12, fontWeight: 700, color: '#47534c' };
const inputStyle: React.CSSProperties = { minWidth: 0, width: '100%', padding: '10px 11px', border: '1px solid #cbd8d0', borderRadius: 5, boxSizing: 'border-box', fontSize: 14 };
const submitButton: React.CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 7, border: 0, borderRadius: 5, padding: '11px 15px', background: '#18704b', color: '#fff', fontWeight: 700, cursor: 'pointer' };
const secondaryButton: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 36, height: 36, border: '1px solid #cbd8d0', borderRadius: 5, background: '#fff', cursor: 'pointer' };
const iconButton: React.CSSProperties = { display: 'inline-grid', placeItems: 'center', width: 30, height: 30, border: '1px solid #e0baba', borderRadius: 4, background: '#fff', color: '#a33', cursor: 'pointer' };
const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 };
const thStyle: React.CSSProperties = { padding: '11px 12px', background: '#f4f8f5', color: '#58645d', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #dce7e0' };
const tdStyle: React.CSSProperties = { padding: '12px', borderBottom: '1px solid #edf1ee', whiteSpace: 'nowrap' };
const statusStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700 };
const emptyStyle: React.CSSProperties = { padding: 28, background: '#fff', border: '1px dashed #cbd8d0', borderRadius: 8, color: '#65716b', textAlign: 'center' };
const errorStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, padding: 11, background: '#fff0ef', color: '#9d322a', borderRadius: 5, fontSize: 13 };

export default MaterialRequestsPage;