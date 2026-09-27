import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle, AlertTriangle, Cpu, ShieldAlert,
  Tag, Weight, DollarSign, Plus, Trash2, Clock, Image as ImageIcon, Loader2, X,
} from 'lucide-react';
import { submissionApi } from './submissionApi';
import { extractFieldErrors, extractGeneralError, type SubmissionFieldErrors } from './submissionErrors';
import { IN_PROGRESS_STATUSES, SUBMISSION_CATEGORIES, type SubmissionResponse } from './types';
import { SubmissionProgress } from './SubmissionProgress';
import { uploadApi } from '../../api/uploadApi';

// Statuses SubmissionProgress can represent as a normal step reached along
// the happy path (including the successful end states it marks "done").
const PROGRESS_STATUSES = ['Analyzing', 'AwaitingReview', 'Scheduling', 'CollectorAssigned', 'AwaitingCollector', 'Collected', 'Closed'];

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;

// Must match UploadRequestValidator on the backend — checked here too so a
// bad file is rejected instantly, without a round trip.
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

interface ItemDraft {
  key: string;
  itemName: string;
  description: string;
  imageUrl: string;
  imageUploading: boolean;
  imageError: string | null;
}

const newItem = (): ItemDraft => ({
  key: crypto.randomUUID(), itemName: '', description: '', imageUrl: '', imageUploading: false, imageError: null,
});

const SubmitPage: React.FC = () => {
  const [category, setCategory] = useState('');
  const [estimatedWeight, setEstimatedWeight] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);

  const [loading, setLoading] = useState(false);
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SubmissionFieldErrors | null>(null);
  const [timedOut, setTimedOut] = useState(false);

  const polling = !!submission && IN_PROGRESS_STATUSES.includes(submission.status) && !timedOut;

  const updateItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));
  const addItem = () => setItems((prev) => (prev.length >= 10 ? prev : [...prev, newItem()]));
  const removeItem = (key: string) => setItems((prev) => (prev.length <= 1 ? prev : prev.filter((it) => it.key !== key)));

  const handleImageSelect = async (key: string, file: File | undefined) => {
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      updateItem(key, { imageError: 'Image must be JPEG, PNG, or WEBP.' });
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      updateItem(key, { imageError: 'Image must be 5 MB or smaller.' });
      return;
    }

    updateItem(key, { imageUploading: true, imageError: null });
    try {
      const url = await uploadApi.uploadImage(file);
      updateItem(key, { imageUrl: url, imageUploading: false });
    } catch (err) {
      console.error(err);
      updateItem(key, { imageUploading: false, imageError: extractGeneralError(err) });
    }
  };

  const anyImageUploading = items.some((it) => it.imageUploading);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSubmission(null);
    setError(null);
    setFieldErrors(null);
    setTimedOut(false);

    try {
      // Owner and user type come from the logged-in session on the backend
      // (the JWT), never from this payload.
      const data = await submissionApi.create({
        category,
        estimatedWeight: Number(estimatedWeight),
        pickupAddress,
        phoneNumber,
        items: items.map(({ itemName, description, imageUrl }) => ({ itemName, description, imageUrl })),
      });
      setSubmission(data);
    } catch (err) {
      console.error(err);
      const fields = extractFieldErrors(err);
      if (fields) setFieldErrors(fields);
      else setError(extractGeneralError(err));
    } finally {
      setLoading(false);
    }
  };

  // Poll while the agent chain is still working on its own. Stops as soon as
  // the derived status leaves Analyzing/Scheduling — that covers every pause
  // (AwaitingReview) and every terminal outcome (CollectorAssigned, Rejected,
  // Failed, Cancelled, Closed, ...) in one check, not a list of old values.
  const submissionId = submission?.id;
  const pollStartedAt = useRef<number>(0);
  useEffect(() => {
    if (!polling || !submissionId) return;
    pollStartedAt.current = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - pollStartedAt.current >= POLL_TIMEOUT_MS) {
        setTimedOut(true);
        return;
      }
      try {
        setSubmission(await submissionApi.getById(submissionId));
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, submissionId]);

  const ai = submission?.workflow?.analysis;

  return (
    <div>
      <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Cpu /> Smart E-Waste Collector
      </h2>
      <p style={{ color: '#666' }}>
        Submit e-waste items for pickup — our AI assesses hazard level and category automatically.
      </p>

      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Category:</label>
          <select
            style={inputStyle}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            required
          >
            <option value="" disabled>Select a category…</option>
            {SUBMISSION_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <FieldError message={fieldErrors?.category} />
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
          <FieldError message={fieldErrors?.estimatedWeight} />
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
          <FieldError message={fieldErrors?.pickupAddress} />
        </div>

        <div style={{ marginBottom: 15 }}>
          <label style={labelStyle}>Phone Number:</label>
          <input
            type="tel"
            style={inputStyle}
            placeholder="e.g. 0771234567 or +94771234567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            required
          />
          <FieldError message={fieldErrors?.phoneNumber} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={labelStyle}>Items ({items.length}/10):</label>
          <FieldError message={fieldErrors?.itemsGeneral} />

          {items.map((item, i) => (
            <div key={item.key} style={itemCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13 }}>Item {i + 1}</strong>
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(item.key)} style={removeBtn} aria-label={`Remove item ${i + 1}`}>
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <input
                type="text"
                style={{ ...inputStyle, marginBottom: 6 }}
                placeholder="Item name (e.g. Laptop)"
                value={item.itemName}
                onChange={(e) => updateItem(item.key, { itemName: e.target.value })}
                required
              />
              <FieldError message={fieldErrors?.items[i]?.itemName} />

              <textarea
                rows={2}
                style={{ ...inputStyle, marginBottom: 6 }}
                placeholder="Description (e.g. Old laptop, screen cracked, still boots)"
                value={item.description}
                onChange={(e) => updateItem(item.key, { description: e.target.value })}
                required
              />
              <FieldError message={fieldErrors?.items[i]?.description} />

              <label style={imagePickerLabel}>
                <ImageIcon size={14} /> {item.imageUrl ? 'Change photo' : 'Add photo (optional)'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    void handleImageSelect(item.key, e.target.files?.[0]);
                    e.target.value = ''; // lets the same file be re-picked after an error
                  }}
                  style={{ display: 'none' }}
                />
              </label>

              {item.imageUploading && (
                <span style={imageStatusRow}>
                  <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> Uploading…
                </span>
              )}
              {item.imageUrl && !item.imageUploading && (
                <div style={imagePreviewRow}>
                  <img src={item.imageUrl} alt="" style={imagePreview} />
                  <button
                    type="button"
                    onClick={() => updateItem(item.key, { imageUrl: '' })}
                    style={removeBtn}
                    aria-label="Remove photo"
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
              {item.imageError && <p style={fieldErrorStyle}>{item.imageError}</p>}
              <FieldError message={fieldErrors?.items[i]?.imageUrl} />
            </div>
          ))}

          <button type="button" onClick={addItem} disabled={items.length >= 10} style={addItemBtn}>
            <Plus size={14} /> Add another item
          </button>
        </div>

        <button type="submit" disabled={loading || polling || anyImageUploading} style={submitBtn}>
          {loading ? 'Submitting…' : polling ? 'Processing…' : anyImageUploading ? 'Uploading photo…' : 'Submit E-Waste Item'}
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

          {PROGRESS_STATUSES.includes(submission.status) && (
            <SubmissionProgress
              status={submission.status}
              approvalRequired={!!submission.workflow?.approvalRequired}
            />
          )}

          {submission.status === 'Failed' && submission.statusReason && (
            <div style={failureBox}>
              <AlertTriangle size={16} /> <span><strong>Failure reason:</strong> {submission.statusReason}</span>
            </div>
          )}
          {submission.status === 'Rejected' && (
            <div style={failureBox}>
              <AlertTriangle size={16} />
              <span><strong>Rejected.</strong>{submission.statusReason ? ` ${submission.statusReason}` : ''}</span>
            </div>
          )}

          {timedOut ? (
            <div style={pollingBox}>
              <Clock size={16} />
              <span>
                Still processing after 2 minutes. Check{' '}
                <Link to="/submissions/mine" style={{ color: '#e65100', fontWeight: 'bold' }}>My Submissions</Link>{' '}
                for updates.
              </span>
            </div>
          ) : polling ? (
            <div style={pollingBox}>
              <span>AI is analyzing your submission…</span>
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
              {submission.workflow?.approvalRequired && submission.status === 'AwaitingReview' && (
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

const FieldError: React.FC<{ message?: string }> = ({ message }) =>
  message ? <p style={fieldErrorStyle}>{message}</p> : null;

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
const fieldErrorStyle: React.CSSProperties = {
  margin: '4px 0 0 0',
  color: '#c62828',
  fontSize: 12,
};
const formStyle: React.CSSProperties = {
  background: '#f9f9f9',
  padding: 20,
  borderRadius: 8,
  border: '1px solid #ddd',
};
const itemCard: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #ddd',
  borderRadius: 6,
  padding: 12,
  marginBottom: 10,
};
const removeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#c62828',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
};
const imagePickerLabel: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: '#eee',
  color: '#333',
  border: '1px dashed #999',
  padding: '8px 12px',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
};
const imageStatusRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  marginTop: 8,
  fontSize: 12,
  color: '#e65100',
};
const imagePreviewRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginTop: 8,
};
const imagePreview: React.CSSProperties = {
  width: 60,
  height: 60,
  objectFit: 'cover',
  borderRadius: 4,
  border: '1px solid #ddd',
};
const addItemBtn: React.CSSProperties = {
  background: '#eee',
  color: '#333',
  border: '1px dashed #999',
  padding: '8px 14px',
  borderRadius: 4,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
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
const failureBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  color: '#c62828',
  background: '#ffebee',
  padding: 12,
  borderRadius: 6,
  marginTop: 10,
};
const aiResultBox: React.CSSProperties = {
  marginTop: 15,
  background: '#f1f8e9',
  padding: 15,
  borderRadius: 6,
  border: '1px solid #c8e6c9',
};

export default SubmitPage;
