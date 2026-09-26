import React, { useEffect, useState } from 'react';
import {
  CheckCircle, AlertTriangle, Cpu, Loader, ShieldAlert,
  Tag, Weight, DollarSign,
} from 'lucide-react';
import { submissionApi } from './submissionApi';
import { IN_PROGRESS_STATUSES, type SubmissionResponse } from './types';

const SubmitPage: React.FC = () => {
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [category, setCategory] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const polling = !!submission && IN_PROGRESS_STATUSES.includes(submission.status);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSubmission(null);
    setError(null);

    try {
      const data = await submissionApi.create({
        category,
        estimatedWeight: Number(estimatedWeight),
        pickupAddress,
        phoneNumber,
        items: [{ itemName: 'E-Waste Item', description, imageUrl }],
      });
      setSubmission(data);
    } catch (err) {
      console.error(err);
      setError('Failed to submit item. Make sure the .NET backend is running.');
    } finally {
      setLoading(false);
    }
  };

  // Poll while the agent chain is still working on its own. It stops at
  // AwaitingReview (a human has to act) and at every final status.
  const submissionId = submission?.id;
  useEffect(() => {
    if (!polling || !submissionId) return;
    const timer = setInterval(async () => {
      try {
        setSubmission(await submissionApi.getById(submissionId));
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 1500);
    return () => clearInterval(timer);
  }, [polling, submissionId]);

  const ai = submission?.workflow?.analysis;

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

        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Category:</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="e.g. IT Equipment"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Estimated Weight (kg):</label>
          <input
            type="number"
            min="0.1"
            step="0.1"
            style={inputStyle}
            value={estimatedWeight}
            onChange={(e) => setEstimatedWeight(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Pickup Address:</label>
          <input
            type="text"
            style={inputStyle}
            placeholder="e.g. 12 Main Street, Colombo 03"
            value={pickupAddress}
            onChange={(e) => setPickupAddress(e.target.value)}
            required
          />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Phone Number:</label>
          <input
            type="tel"
            style={inputStyle}
            placeholder="e.g. 0771234567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
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
          <p><strong>Status:</strong> {submission.statusLabel}</p>
          {submission.statusReason && (
            <p><strong>Reason:</strong> {submission.statusReason}</p>
          )}

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
              {submission.workflow?.approvalRequired && (
                <p style={{ marginTop: 10, fontWeight: 'bold', color: '#c62828' }}>
                  ⚠️ Requires Admin Approval
                </p>
              )}
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