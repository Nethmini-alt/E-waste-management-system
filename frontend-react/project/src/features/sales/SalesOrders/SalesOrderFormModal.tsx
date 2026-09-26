/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, AlertCircle } from 'lucide-react';
import { buyerApi } from '../Buyers/buyerApi';
import { pricingApi } from '../Pricing/pricingApi';
import { materialApi } from '../Materials/materialApi';
import type { Buyer } from '../Buyers/types';
import type { MaterialPricing } from '../Pricing/types';
import type { RecoveredMaterial } from '../Materials/types';
import type { CreateSalesOrderRequest } from './types';

interface LineInput {
  key: string;
  recoveredMaterialId: string;
  quantityKg: string; // keep as string for the input; parse on submit
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: CreateSalesOrderRequest) => Promise<void>;
}

const newLine = (): LineInput => ({
  key: Math.random().toString(36).slice(2),
  recoveredMaterialId: '',
  quantityKg: '',
});

const SalesOrderFormModal: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [materials, setMaterials] = useState<RecoveredMaterial[]>([]);
  const [prices, setPrices] = useState<MaterialPricing[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [buyerId, setBuyerId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineInput[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load metadata when modal opens
  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoadingMeta(true);
      setMetaError(null);
      try {
        const [buyersData, materialsData, pricesData] = await Promise.all([
          buyerApi.list(),
          materialApi.listAvailable(),
          pricingApi.list({ status: 'Approved' }),
        ]);
        setBuyers(buyersData.filter((b) => b.status === 'Active'));
        setMaterials(materialsData);
        setPrices(pricesData);
      } catch (e: any) {
        setMetaError(e?.response?.data?.title ?? 'Failed to load form data.');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [open]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setBuyerId('');
      setNotes('');
      setLines([newLine()]);
      setError(null);
    }
  }, [open]);

  // Price lookup by material type. Only "live" prices count — the server prices orders
  // exclusively from Approved rows whose expiry date has not passed, so including a dead
  // price here would make this estimate disagree with the total the server computes.
  const priceByMaterialType = useMemo(() => {
    const map = new Map<string, number>();
    prices.filter((p) => p.isLive).forEach((p) => map.set(p.materialType, p.pricePerKg));
    return map;
  }, [prices]);

  // Live estimate
  const estimate = useMemo(() => {
    let total = 0;
    for (const line of lines) {
      const material = materials.find((m) => m.recoveredMaterialId === line.recoveredMaterialId);
      const qty = parseFloat(line.quantityKg);
      if (!material || isNaN(qty) || qty <= 0) continue;
      const price = priceByMaterialType.get(material.materialType) ?? 0;
      total += qty * price;
    }
    return total;
  }, [lines, materials, priceByMaterialType]);

  const updateLine = (key: string, patch: Partial<LineInput>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));

  // Client-side validation (backend re-validates everything)
  const validate = (): string | null => {
    if (!buyerId) return 'Please select a buyer.';
    if (lines.length === 0) return 'Add at least one line item.';
    for (const line of lines) {
      if (!line.recoveredMaterialId) return 'Every line needs a material.';
      const qty = parseFloat(line.quantityKg);
      if (isNaN(qty) || qty <= 0) return 'Every line needs a positive quantity.';

      const material = materials.find((m) => m.recoveredMaterialId === line.recoveredMaterialId);
      if (material && qty > material.quantityKg) {
        return `Quantity for ${material.materialType} exceeds available ${material.quantityKg}kg.`;
      }
      if (material && !priceByMaterialType.has(material.materialType)) {
        return `No approved price for ${material.materialType}.`;
      }
    }
    // Duplicate material check
    const ids = lines.map((l) => l.recoveredMaterialId).filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      return 'Each material can appear only once. Combine quantities into one line.';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        buyerId,
        notes: notes || undefined,
        items: lines.map((l) => ({
          recoveredMaterialId: l.recoveredMaterialId,
          quantityKg: parseFloat(l.quantityKg),
        })),
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>New Sales Order</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {loadingMeta ? (
          <p style={{ marginTop: 20 }}>Loading form data…</p>
        ) : metaError ? (
          <div style={errorBox}><AlertCircle size={16} /> {metaError}</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 15 }}>
            <Field label="Buyer" required>
              <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} style={input}>
                <option value="">— Select an active buyer —</option>
                {buyers.map((b) => (
                  <option key={b.buyerId} value={b.buyerId}>
                    {b.companyName} ({b.contactPerson})
                  </option>
                ))}
              </select>
              {buyers.length === 0 && (
                <div style={{ fontSize: 12, color: '#c62828', marginTop: 4 }}>
                  No active buyers. Activate one from the Buyers page first.
                </div>
              )}
            </Field>

            <Field label="Notes (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={input}
                placeholder="Internal reference, special instructions, etc."
              />
            </Field>

            {/* Line items */}
            <div style={{ marginTop: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontWeight: 'bold', fontSize: 13 }}>Line Items</label>
                <button type="button" onClick={addLine} style={btnSmall}>
                  <Plus size={13} /> Add line
                </button>
              </div>

              {materials.length === 0 && (
                <div style={{ fontSize: 12, color: '#c62828', marginBottom: 8 }}>
                  No sellable materials available. Ensure prices are approved and material is Ready.
                </div>
              )}

              {lines.map((line, idx) => {
                const material = materials.find((m) => m.recoveredMaterialId === line.recoveredMaterialId);
                const qty = parseFloat(line.quantityKg);
                const price = material ? priceByMaterialType.get(material.materialType) : undefined;
                const lineTotal = material && !isNaN(qty) && price ? qty * price : 0;

                return (
                  <div
                    key={line.key}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr auto',
                      gap: 8,
                      alignItems: 'center',
                      padding: 8,
                      border: '1px solid #eee',
                      borderRadius: 6,
                      marginBottom: 8,
                      background: '#fafafa',
                    }}
                  >
                    <select
                      value={line.recoveredMaterialId}
                      onChange={(e) => updateLine(line.key, { recoveredMaterialId: e.target.value })}
                      style={input}
                    >
                      <option value="">— Material —</option>
                      {materials.map((m) => {
                        const hasPrice = priceByMaterialType.has(m.materialType);
                        return (
                          <option
                            key={m.recoveredMaterialId}
                            value={m.recoveredMaterialId}
                            disabled={!hasPrice}
                          >
                            {m.materialType} · {m.quantityKg}kg · {m.qualityGrade}
                            {!hasPrice ? ' (no price)' : ''}
                          </option>
                        );
                      })}
                    </select>

                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Quantity (kg)"
                      value={line.quantityKg}
                      onChange={(e) => updateLine(line.key, { quantityKg: e.target.value })}
                      style={input}
                    />

                    <div style={{ fontSize: 13, color: '#555', textAlign: 'right', paddingRight: 8 }}>
                      {price ? `Rs. ${lineTotal.toFixed(2)}` : '—'}
                    </div>

                    <button
                      type="button"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                      style={{ ...iconBtn, color: lines.length === 1 ? '#bbb' : '#c62828' }}
                      title="Remove line"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}

              {/* Estimated total */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 15,
                  marginTop: 10,
                  fontSize: 14,
                }}
              >
                <span style={{ color: '#666' }}>Estimated total:</span>
                <strong style={{ fontSize: 16 }}>Rs. {estimate.toFixed(2)}</strong>
              </div>
              <div style={{ fontSize: 11, color: '#999', textAlign: 'right', marginTop: 2 }}>
                Final total is calculated by the server using currently approved prices.
              </div>
            </div>

            {error && <div style={errorBox}><AlertCircle size={16} /> {error}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
              <button type="submit" disabled={submitting} style={btnPrimary}>
                {submitting ? 'Creating…' : 'Create Order'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

// ---------- Helpers ----------
const Field: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({
  label, required, children,
}) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
      {label} {required && <span style={{ color: '#c62828' }}>*</span>}
    </label>
    {children}
  </div>
);

// ---------- Styles ----------
const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal: React.CSSProperties = {
  background: '#fff', padding: 25, borderRadius: 10, width: 720,
  maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
};
const input: React.CSSProperties = {
  width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 6,
};
const btnPrimary: React.CSSProperties = {
  background: '#1565c0', color: '#fff', border: 'none', padding: '10px 16px',
  borderRadius: 6, cursor: 'pointer', fontWeight: 'bold',
};
const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '10px 16px',
  borderRadius: 6, cursor: 'pointer',
};
const btnSmall: React.CSSProperties = {
  background: '#e3f2fd', color: '#1565c0', border: 'none', padding: '6px 10px',
  borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 'bold',
  display: 'flex', alignItems: 'center', gap: 4,
};
const errorBox: React.CSSProperties = {
  marginTop: 15, padding: 10, background: '#ffebee', color: '#c62828',
  borderRadius: 6, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6,
};

export default SalesOrderFormModal;