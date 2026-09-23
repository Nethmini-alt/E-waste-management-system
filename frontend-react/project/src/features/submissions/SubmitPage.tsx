/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useState } from 'react';
import {
  CheckCircle, AlertTriangle, Cpu, Loader, ShieldAlert,
  Tag, Weight, DollarSign,
} from 'lucide-react';
import { submissionApi } from './submissionApi';
import type { SubmissionResponse } from './types';

const SubmitPage: React.FC = () => {
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSubmission(null);
    setError(null);

    try {
      const data = await submissionApi.create({
        userId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        userType: 'Generator',
        items: [{ itemName: 'E-Waste Item', description, imageUrl }],
      });
      setSubmission(data);
      setPolling(true);
    } catch (err) {
      console.error(err);
      setError('Failed to submit item. Make sure the .NET backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (polling && submission?.id) {
      timer = setInterval(async () => {
        try {
          const data = await submissionApi.getById(submission.id);
          const hasAi = data.aiAnalysis || (data as any).aIAnalysis;
          if (hasAi || data.status === 'Approved' || data.status === 'Analyzed') {
            setSubmission(data);
            setPolling(false);
          }
        } catch (err) {
          console.error('Polling error:', err);
        }
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [polling, submission?.id]);

  const ai = submission?.aiAnalysis || (submission as any)?.aIAnalysis;

  return (
    <div>
      <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Cpu /> Smart E-Waste Collector
      </h2>
      <p style={{ color: '#666' }}>
        Upload e-waste items for instant AI assessment & hazard categorization.
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Item Description:</label>
          <textarea
            rows={3}
            style={inputStyle}
            placeholder="e.g. Swollen lithium battery leaking chemical liquid…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Image URL:</label>
          <input
            type="url"
            style={inputStyle}
            placeholder="https://example.com/image.jpg"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading || polling} style={submitBtn}>
          {loading
            ? 'Submitting…'
            : polling
            ? 'Analyzing…'
            : 'Submit E-Waste Item'}
        </button>
      </form>

      {error && (
        <div style={errorBanner}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {submission && (
        <div style={resultCard}>
          <h3 style={{ color: '#2e7d32', marginTop: 0 }}>
            <CheckCircle size={18} /> Submission Recorded
          </h3>
          <p><strong>ID:</strong> <code>{submission.id}</code></p>
          <p><strong>Status:</strong> {submission.status}</p>

          {polling ? (
            <div style={pollingBox}>
              <Loader
                size={16}
                style={{ animation: 'spin 1s linear infinite' }}
              />
              <span>AI is analyzing your image & description…</span>
            </div>
          ) : ai ? (
            <div style={aiResultBox}>
              <h4 style={{ margin: '0 0 10px 0' }}>🤖 AI Assessment</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <p><Tag size={14} /> <strong>Category:</strong> {ai.wasteCategory}</p>
                <p>
                  <ShieldAlert size={14} /> <strong>Hazard:</strong>{' '}
                  <span
                    style={{
                      color:
                        ai.hazardLevel === 'Critical' || ai.hazardLevel === 'High'
                          ? 'red'
                          : 'green',
                      fontWeight: 'bold',
                    }}
                  >
                    {ai.hazardLevel}
                  </span>
                </p>
                <p><Weight size={14} /> <strong>Est. Weight:</strong> {ai.estimatedVolumeKg} kg</p>
                <p><DollarSign size={14} /> <strong>Est. Value:</strong> ${ai.estimatedValueUsd}</p>
              </div>
              <p
                style={{
                  marginTop: 10,
                  fontWeight: 'bold',
                  color: ai.requiresHumanApproval ? '#c62828' : '#2e7d32',
                }}
              >
                {ai.requiresHumanApproval
                  ? '⚠️ Requires Admin Approval'
                  : '✅ Auto-Approved for Collection'}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontWeight: 'bold',
  marginBottom: 5,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 4,
  border: '1px solid #ccc',
  boxSizing: 'border-box',
};
const formStyle: React.CSSProperties = {
  background: '#f9f9f9',
  padding: 20,
  borderRadius: 8,
  border: '1px solid #ddd',
};
const submitBtn: React.CSSProperties = {
  background: '#2e7d32',
  color: '#fff',
  border: 'none',
  padding: '12px 20px',
  borderRadius: 4,
  cursor: 'pointer',
  fontWeight: 'bold',
};
const errorBanner: React.CSSProperties = {
  marginTop: 20,
  padding: 15,
  background: '#ffebee',
  color: '#c62828',
  borderRadius: 4,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};
const resultCard: React.CSSProperties = {
  marginTop: 20,
  padding: 20,
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 8,
};
const pollingBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  color: '#e65100',
  background: '#fff3e0',
  padding: 12,
  borderRadius: 6,
};
const aiResultBox: React.CSSProperties = {
  marginTop: 15,
  background: '#f1f8e9',
  padding: 15,
  borderRadius: 6,
  border: '1px solid #c8e6c9',
};

export default SubmitPage;