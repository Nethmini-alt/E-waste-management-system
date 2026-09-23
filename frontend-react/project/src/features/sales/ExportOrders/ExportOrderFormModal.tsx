/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, AlertCircle, Globe, Calendar } from 'lucide-react';
import { buyerApi } from '../Buyers/buyerApi';
import { pricingApi } from '../Pricing/pricingApi';
import { materialApi } from '../Materials/materialApi';
import type { Buyer } from '../Buyers/types';
import type { MaterialPricing } from '../Pricing/types';
import type { RecoveredMaterial } from '../Materials/types';
import type { CreateExportOrderRequest } from './types';

interface LineInput {
  key: string;
  recoveredMaterialId: string;
  quantityKg: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (body: CreateExportOrderRequest) => Promise<void>;
}

const MIN_TOTAL_WEIGHT_KG = 20;
const newLine = (): LineInput => ({
  key: Math.random().toString(36).slice(2),
  recoveredMaterialId: '',
  quantityKg: '',
});

// A few common destinations — extend as needed
const DESTINATIONS = [
  'India', 'China', 'Singapore', 'Malaysia', 'UAE', 'Germany', 'UK', 'USA',
];

const ExportOrderFormModal: React.FC<Props> = ({ open, onClose, onSubmit }) => {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [materials, setMaterials] = useState<RecoveredMaterial[]>([]);
  const [prices, setPrices] = useState<MaterialPricing[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [buyerId, setBuyerId] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [shipmentDate, setShipmentDate] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineInput[]>([newLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Only export-type, active buyers are eligible
        setBuyers(
          buyersData.filter(
            (b) => b.status === 'Active' && b.buyerType === 'Export'
          )
        );
        setMaterials(materialsData);
        setPrices(pricesData);
      } catch (e: any) {
        setMetaError(e?.response?.data?.title ?? 'Failed to load form data.');
      } finally {
        setLoadingMeta(false);
      }
    })();
  }, [open]);

  useEffect(() => {
    if (open) {
      setBuyerId('');
      setDestinationCountry('');
      setShipmentDate('');
      setNotes('');
      setLines([newLine()]);
      setError(null);
    }
  }, [open]);

  const priceByMaterialType = useMemo(() => {
    const map = new Map<string, number>();
    prices.forEach((p) => map.set(p.materialType, p.pricePerKg));
    return map;
  }, [prices]);

  const totalWeightKg = useMemo(() => {
    return lines.reduce((sum, l) => {
      const q = parseFloat(l.quantityKg);
      return sum + (isNaN(q) ? 0 : q);
    }, 0);
  }, [lines]);

  const estimateValue = useMemo(() => {
    let total = 0;
    for (const line of lines) {
      const m = materials.find((x) => x.recoveredMaterialId === line.recoveredMaterialId);
      const q = parseFloat(line.quantityKg);
      if (!m || isNaN(q) || q <= 0) continue;
      const price = priceByMaterialType.get(m.materialType) ?? 0;
      total += q * price;
    }
    return total;
  }, [lines, materials, priceByMaterialType]);

  const updateLine = (key: string, patch: Partial<LineInput>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, newLine()]);
  const removeLine = (key: string) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((l) => l.key !== key)));

  const validate = (): string | null => {
    if (!buyerId) return 'Please select an export buyer.';
    if (!destinationCountry.trim()) return 'Destination country is required.';
    if (!shipmentDate) return 'Shipment date is required.';

    const today = new Date().toISOString().slice(0, 10);
    if (shipmentDate < today) return 'Shipment date cannot be in the past.';

    if (lines.length === 0) return 'Add at least one line item.';

    for (const line of lines) {
      if (!line.recoveredMaterialId) return 'Every line needs a material.';
      const qty = parseFloat(line.quantityKg);
      if (isNaN(qty) || qty <= 0) return 'Every line needs a positive quantity.';

      const material = materials.find((m) => m.recoveredMaterialId === line.recoveredMaterialId);
      if (material && qty > material.quantityKg)
        return `Quantity for ${material.materialType} exceeds available ${material.quantityKg}kg.`;
      if (material && !priceByMaterialType.has(material.materialType))
        return `No approved price for ${material.materialType}.`;
    }

    const ids = lines.map((l) => l.recoveredMaterialId).filter(Boolean);
    if (new Set(ids).size !== ids.length)
      return 'Each material can appear only once. Combine quantities into one line.';

    if (totalWeightKg < MIN_TOTAL_WEIGHT_KG)
      return `Total shipment weight must be at least ${MIN_TOTAL_WEIGHT_KG} kg for export.`;

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const v = validate();
    if (v) { setError(v); return; }

    setSubmitting(true);
    try {
      await onSubmit({
        buyerId,
        destinationCountry: destinationCountry.trim(),
        shipmentDate,
        notes: notes || undefined,
        items: lines.map((l) => ({
          recoveredMaterialId: l.recoveredMaterialId,
          quantityKg: parseFloat(l.quantityKg),
        })),
      });
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.response?.data?.title ?? 'Failed to create export order.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>New Export Order</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        {loadingMeta ? (
          <p style={{ marginTop: 20 }}>Loading form data…</p>
        ) : metaError ? (
          <div style={errorBox}><AlertCircle size={16} /> {metaError}</div>
        ) : (
          <form onSubmit={handleSubmit} style={{ marginTop: 15 }}>
            <Field label="Export Buyer" required>
              <select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} style={input}>
                <option value="">— Select an export buyer —</option>
                {buyers.map((b) => (
                  <option key={b.buyerId} value={b.buyerId}>
                    {b.companyName} ({b.contactPerson})
                  </option>
                ))}
              </select>
              {buyers.length === 0 && (
                <div style={{ fontSize: 12, color: '#c62828', marginTop: 4 }}>
                  No Active Export-type buyers. Register one with Buyer Type = Export first.
                </div>
              )}
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Destination Country" required>
                <div style={{ position: 'relative' }}>
                  <Globe
                    size={14}
                    style={{
                      position: 'absolute', left: 10, top: '50%',
                      transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none',
                    }}
                  />
                  <input
                    list="destinations"
                    value={destinationCountry}
                    onChange={(e) => setDestinationCountry(e.target.value)}
                    style={{ ...input, paddingLeft: 32 }}
                    placeholder="e.g. India"
                  />
                  <datalist id="destinations">
                    {DESTINATIONS.map((d) => <option key={d} value={d} />)}
                  </datalist>
                </div>
              </Field>

              <Field label="Shipment Date" required>
                <div style={{ position: 'relative' }}>
                  <Calendar
                    size={14}
                    style={{
                      position: 'absolute', left: 10, top: '50%',
                      transform: 'translateY(-50%)', color: '#888', pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="date"
                    value={shipmentDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setShipmentDate(e.target.value)}
                    style={{ ...input, paddingLeft: 32 }}
                  />
                </div>
              </Field>
            </div>

            <Field label="Notes (optional)">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                style={input}
                placeholder="Customs notes, shipping instructions, etc."
              />
            </Field>

            {/* Line items — same pattern as Sales */}
            <div style={{ marginTop: 15 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontWeight: 'bold', fontSize: 13 }}>Line Items</label>
                <button type="button" onClick={addLine} style={btnSmall}>
                  <Plus size={13} /> Add line
                </button>
              </div>

              {materials.length === 0 && (
                <div style={{ fontSize: 12, color: '#c62828', marginBottom: 8 }}>
                  No sellable materials available.
                </div>
              )}

              {lines.map((line) => {
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
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })}

              {/* Totals */}
              <div
                style={{
                  marginTop: 10,
                  padding: 10,
                  background: totalWeightKg < MIN_TOTAL_WEIGHT_KG ? '#fff3e0' : '#f1f8e9',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>
                    Total weight:{' '}
                    <strong>{totalWeightKg.toFixed(2)} kg</strong>
                    {totalWeightKg < MIN_TOTAL_WEIGHT_KG && (
                      <span style={{ color: '#e65100', marginLeft: 8 }}>
                        (min {MIN_TOTAL_WEIGHT_KG} kg for export)
                      </span>
                    )}
                  </span>
                  <span>
                    Estimated value:{' '}
                    <strong>Rs. {estimateValue.toFixed(2)}</strong>
                  </span>
                </div>
              </div>
            </div>

            {error && <div style={errorBox}><AlertCircle size={16} /> {error}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
              <button type="submit" disabled={submitting} style={btnPrimary}>
                {submitting ? 'Creating…' : 'Create Export Order'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

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

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal: React.CSSProperties = {
  background: '#fff', padding: 25, borderRadius: 10, width: 760,
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

export default ExportOrderFormModal;