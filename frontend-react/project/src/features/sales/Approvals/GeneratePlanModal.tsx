
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Sparkles,
  ShoppingCart,
  Ship,
  AlertCircle,
} from 'lucide-react';

import { buyerApi } from '../Buyers/buyerApi';
import { salesOrderApi } from '../SalesOrders/salesOrderApi';
import { exportOrderApi } from '../ExportOrders/exportOrderApi';

import type { Buyer } from '../Buyers/types';

type OrderKind = 'sales' | 'export';

interface OrderOption {
  kind: OrderKind;
  id: string;
  label: string;
  status: string;
  materialTypes: string[];
  totalKg: number;
  route: 'LocalSale' | 'Export';
}

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (goal: {
    targetBuyerId?: string;
    targetMaterialTypes?: string[];
    maxQuantityKg?: number;
    preferredRoute?: 'LocalSale' | 'Export';
  }) => Promise<void>;
}

const GeneratePlanModal: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
}) => {
  // Buyers
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);

  // Selected buyer and order
  const [buyerId, setBuyerId] = useState('');
  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');

  // Editable goal fields
  const [materialsText, setMaterialsText] = useState('');
  const [maxKg, setMaxKg] = useState('');
  const [route, setRoute] = useState<
    '' | 'LocalSale' | 'Export'
  >('');

  // Meta
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active buyers when modal opens
  useEffect(() => {
    if (!open) return;

    (async () => {
      setLoadingBuyers(true);

      try {
        const all = await buyerApi.list();

        setBuyers(
          all.filter((b) => b.status === 'Active'),
        );
      } catch {
        setBuyers([]);
      } finally {
        setLoadingBuyers(false);
      }
    })();
  }, [open]);

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setBuyerId('');
      setOrders([]);
      setSelectedOrderId('');
      setMaterialsText('');
      setMaxKg('');
      setRoute('');
      setError(null);
    }
  }, [open]);

  // Load orders when buyer changes
  useEffect(() => {
    if (!buyerId) {
      setOrders([]);
      setSelectedOrderId('');
      return;
    }

    (async () => {
      setLoadingOrders(true);
      setSelectedOrderId('');

      try {
        const [sales, exports] = await Promise.all([
          salesOrderApi.list({ buyerId }),
          exportOrderApi.list({ buyerId }),
        ]);

        const salesOpts: OrderOption[] = sales.map((o) => ({
          kind: 'sales',
          id: o.salesOrderId,
          label: `Local #${o.salesOrderId.slice(0, 8)} — ${o.status}`,
          status: o.status,
          materialTypes: Array.from(
            new Set(o.items.map((i) => i.materialType)),
          ),
          totalKg: o.items.reduce(
            (s, i) => s + i.quantityKg,
            0,
          ),
          route: 'LocalSale',
        }));

        const exportOpts: OrderOption[] = exports.map((o) => ({
          kind: 'export',
          id: o.exportOrderId,
          label: `Export #${o.exportOrderId.slice(0, 8)} — ${o.status}`,
          status: o.status,
          materialTypes: Array.from(
            new Set(o.items.map((i) => i.materialType)),
          ),
          totalKg: o.items.reduce(
            (s, i) => s + i.quantityKg,
            0,
          ),
          route: 'Export',
        }));

        setOrders([...salesOpts, ...exportOpts]);
      } catch {
        setOrders([]);
      } finally {
        setLoadingOrders(false);
      }
    })();
  }, [buyerId]);

  // Prefill fields when order is selected
  useEffect(() => {
    const order = orders.find(
      (o) => o.id === selectedOrderId,
    );

    if (!order) return;

    setMaterialsText(order.materialTypes.join(', '));
    setMaxKg(String(order.totalKg));
    setRoute(order.route);
  }, [selectedOrderId, orders]);

  const selectedOrder = useMemo(
    () =>
      orders.find((o) => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  // Submit the form
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    setError(null);
    setSubmitting(true);

    try {
      const goal: {
        targetBuyerId?: string;
        targetMaterialTypes?: string[];
        maxQuantityKg?: number;
        preferredRoute?: 'LocalSale' | 'Export';
      } = {};

      if (buyerId) {
        goal.targetBuyerId = buyerId;
      }

      const mats = materialsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      if (mats.length > 0) {
        goal.targetMaterialTypes = mats;
      }

      const kg = parseFloat(maxKg);

      if (!isNaN(kg) && kg > 0) {
        goal.maxQuantityKg = kg;
      }

      if (route) {
        goal.preferredRoute = route;
      }

      await onSubmit(goal);
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.detail ??
          err?.response?.data?.title ??
          'Failed to run agent.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div
        style={modal}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3
            style={{
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Sparkles size={18} />
            Generate AI Commercial Plan
          </h3>

          <button
            onClick={onClose}
            style={iconBtn}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <p
          style={{
            color: '#666',
            fontSize: 13,
            marginTop: 8,
          }}
        >
          Select a buyer and optionally an existing order
          to seed the agent&apos;s goal. Override any field
          before running.
        </p>

        <form onSubmit={submit} style={{ marginTop: 12 }}>
          {/* Buyer */}
          <Field label="Buyer">
            <select
              value={buyerId}
              onChange={(e) => setBuyerId(e.target.value)}
              style={input}
            >
              <option value="">
                — Any eligible buyer —
              </option>

              {loadingBuyers && (
                <option disabled>Loading…</option>
              )}

              {!loadingBuyers &&
                buyers.map((b) => (
                  <option
                    key={b.buyerId}
                    value={b.buyerId}
                  >
                    {b.companyName} ({b.buyerType})
                  </option>
                ))}
            </select>
          </Field>

          {/* Existing orders */}
          {buyerId && (
            <Field label="Seed from Existing Order (optional)">
              {loadingOrders ? (
                <div style={{ fontSize: 13, color: '#888' }}>
                  Loading orders…
                </div>
              ) : orders.length === 0 ? (
                <div style={{ fontSize: 13, color: '#888' }}>
                  This buyer has no prior orders.
                </div>
              ) : (
                <select
                  value={selectedOrderId}
                  onChange={(e) =>
                    setSelectedOrderId(e.target.value)
                  }
                  style={input}
                >
                  <option value="">
                    — Start fresh (no prefill) —
                  </option>

                  {orders.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.kind === 'export' ? '🌍' : '📦'}{' '}
                      {o.label} · {o.totalKg.toFixed(1)}kg
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}

          {/* Selected order preview */}
          {selectedOrder && (
            <div style={prefillBox}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                {selectedOrder.kind === 'export' ? (
                  <Ship size={14} color="#6a1b9a" />
                ) : (
                  <ShoppingCart
                    size={14}
                    color="#1565c0"
                  />
                )}

                <strong style={{ fontSize: 13 }}>
                  Prefilled from{' '}
                  {selectedOrder.kind === 'export'
                    ? 'Export'
                    : 'Local'}{' '}
                  order
                </strong>
              </div>

              <div style={{ fontSize: 12, color: '#555' }}>
                <div>
                  Materials:{' '}
                  <strong>
                    {selectedOrder.materialTypes.join(', ')}
                  </strong>
                </div>

                <div>
                  Total quantity:{' '}
                  <strong>
                    {selectedOrder.totalKg.toFixed(2)} kg
                  </strong>
                </div>

                <div>
                  Route preference:{' '}
                  <strong>
                    {selectedOrder.route === 'Export'
                      ? 'Export'
                      : 'Local Sale'}
                  </strong>
                </div>
              </div>
            </div>
          )}

          {/* Material types */}
          <Field label="Material Types (comma-separated)">
            <input
              value={materialsText}
              onChange={(e) =>
                setMaterialsText(e.target.value)
              }
              style={input}
              placeholder="e.g. Copper, Aluminium"
            />
          </Field>

          {/* Maximum quantity */}
          <Field label="Max Total Quantity (kg)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={maxKg}
              onChange={(e) => setMaxKg(e.target.value)}
              style={input}
              placeholder="e.g. 100"
            />
          </Field>

          {/* Route */}
          <Field label="Preferred Route">
            <select
              value={route}
              onChange={(e) =>
                setRoute(
                  e.target.value as
                    | ''
                    | 'LocalSale'
                    | 'Export',
                )
              }
              style={input}
            >
              <option value="">
                — Let agent decide —
              </option>
              <option value="LocalSale">
                Local Sale
              </option>
              <option value="Export">Export</option>
            </select>
          </Field>

          {/* Error */}
          {error && (
            <div style={errorBox}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              marginTop: 20,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={btnSecondary}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              style={btnPrimary}
            >
              <Sparkles size={14} />
              {submitting
                ? 'Running agent…'
                : 'Run Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ---------- Helpers ----------

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div style={{ marginBottom: 12 }}>
    <label
      style={{
        display: 'block',
        fontWeight: 'bold',
        fontSize: 13,
        marginBottom: 4,
      }}
    >
      {label}
    </label>
    {children}
  </div>
);

// ---------- Styles ----------

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: '#fff',
  padding: 25,
  borderRadius: 10,
  width: 520,
  maxWidth: 'calc(100vw - 32px)',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
};

const input: React.CSSProperties = {
  width: '100%',
  padding: 8,
  borderRadius: 6,
  border: '1px solid #ccc',
  boxSizing: 'border-box',
};

const iconBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
};

const btnPrimary: React.CSSProperties = {
  background: '#1565c0',
  color: '#fff',
  border: 'none',
  padding: '10px 16px',
  borderRadius: 6,
  cursor: 'pointer',
  fontWeight: 'bold',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const btnSecondary: React.CSSProperties = {
  background: '#eee',
  color: '#333',
  border: 'none',
  padding: '10px 16px',
  borderRadius: 6,
  cursor: 'pointer',
};

const prefillBox: React.CSSProperties = {
  padding: 10,
  background: '#f5f9ff',
  border: '1px solid #cfe2ff',
  borderRadius: 6,
  marginBottom: 12,
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  padding: 10,
  background: '#ffebee',
  color: '#c62828',
  borderRadius: 6,
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

export default GeneratePlanModal;