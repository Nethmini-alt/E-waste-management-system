import React from 'react';
import { X } from 'lucide-react';
import type { SalesOrder } from './types';

interface Props {
  order: SalesOrder | null;
  onClose: () => void;
}

const SalesOrderDetailModal: React.FC<Props> = ({ order, onClose }) => {
  if (!order) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>Order Details</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <div style={{ marginTop: 15, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 13 }}>
          <Info label="Order ID" value={order.salesOrderId} mono />
          <Info label="Status" value={order.status} />
          <Info label="Buyer" value={order.buyerCompanyName} />
          <Info label="Order Date" value={new Date(order.orderDate).toLocaleString()} />
          <Info label="Total Amount" value={`Rs. ${order.totalAmount.toFixed(2)}`} />
          <Info label="Created" value={new Date(order.createdAt).toLocaleString()} />
        </div>

        {order.notes && (
          <div style={{ marginTop: 12, padding: 10, background: '#fafafa', borderRadius: 6, fontSize: 13 }}>
            <strong>Notes:</strong> {order.notes}
          </div>
        )}

        <h4 style={{ marginTop: 20, marginBottom: 8 }}>Line Items</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
              <th style={th}>Material</th>
              <th style={th}>Quantity</th>
              <th style={th}>Unit Price</th>
              <th style={{ ...th, textAlign: 'right' }}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.salesOrderItemId} style={{ borderTop: '1px solid #eee' }}>
                <td style={td}>{i.materialType}</td>
                <td style={td}>{i.quantityKg.toFixed(2)} kg</td>
                <td style={td}>Rs. {i.unitPrice.toFixed(2)}</td>
                <td style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>
                  Rs. {i.lineTotal.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: '2px solid #ddd' }}>
              <td colSpan={3} style={{ ...td, textAlign: 'right', fontWeight: 'bold' }}>Grand Total</td>
              <td style={{ ...td, textAlign: 'right', fontWeight: 'bold', fontSize: 15 }}>
                Rs. {order.totalAmount.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

const Info: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <div style={{ color: '#888', fontSize: 11, textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontFamily: mono ? 'monospace' : 'inherit', wordBreak: 'break-all' }}>{value}</div>
  </div>
);

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal: React.CSSProperties = {
  background: '#fff', padding: 25, borderRadius: 10, width: 640,
  maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
};
const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', cursor: 'pointer', padding: 4 };
const th: React.CSSProperties = { padding: 8, fontWeight: 'bold' };
const td: React.CSSProperties = { padding: 8 };

export default SalesOrderDetailModal;