/* eslint-disable react-hooks/rules-of-hooks */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect, useState } from 'react';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';
import type { CreateBuyerRequest, UpdateBuyerRequest } from './types';


const schema = z.object({
  userId: z.string().min(1,'Please select a user'),
  companyName: z.string().min(1, 'Required').max(150),
  contactPerson: z.string().min(1, 'Required').max(100),
  email: z.string().email('Invalid email').max(150),
  phoneNumber: z.string().max(30).optional().or(z.literal('')),
  address: z.string().optional().or(z.literal('')),
  buyerType: z.enum(['Local', 'Export']),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: FormValues) => Promise<void>;
  initial?: Partial<FormValues>;
  title: string;
}

const BuyerFormModal: React.FC<Props> = ({ open, onClose, onSubmit, initial, title }) => {
  const [availableUsers, setAvailableUsers] = useState<{userId: string; fullName: string; email: string}[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      userId: '',
      companyName: '',
      contactPerson: '',
      email: '',
      phoneNumber: '',
      address: '',
      buyerType: 'Local',
      ...initial,
    },
  });

  useEffect(() => {
  if (!open) return;
  if (initial?.userId) return; // editing — userId can't change, no need to load list

  (async () => {
    setLoadingUsers(true);
    try {
      const users = await (await import('./buyerApi')).buyerApi.availableUsers();
      setAvailableUsers(users);
    } catch {
      setAvailableUsers([]);
    } finally {
      setLoadingUsers(false);
    }
  })();
  }, [open, initial?.userId]);

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={iconBtn}><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} style={{ marginTop: 15 }}>
          <Field label="Linked Corporate User" error={errors.userId?.message}>
            {initial?.userId ? (
              // Edit mode — show read-only
              <input
                value={initial.userId}
                disabled
                style={{ ...input, background: '#f5f5f5', color: '#666' }}
              />
            ) : loadingUsers ? (
              <div style={{ fontSize: 13, color: '#666' }}>Loading available users…</div>
            ) : availableUsers.length === 0 ? (
              <div style={{ fontSize: 13, color: '#c62828' }}>
                No unlinked Corporate users available. Register one first via{' '}
                <strong>/register</strong>.
              </div>
            ) : (
              <select {...register('userId')} style={input}>
                <option value="">— Select a user —</option>
                {availableUsers.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.fullName} ({u.email})
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Field label="Company Name" error={errors.companyName?.message}>
            <input {...register('companyName')} style={input} />
          </Field>

          <Field label="Contact Person" error={errors.contactPerson?.message}>
            <input {...register('contactPerson')} style={input} />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input type="email" {...register('email')} style={input} />
          </Field>

          <Field label="Phone (optional)" error={errors.phoneNumber?.message}>
            <input {...register('phoneNumber')} style={input} />
          </Field>

          <Field label="Address (optional)" error={errors.address?.message}>
            <textarea {...register('address')} rows={2} style={input} />
          </Field>

          <Field label="Buyer Type" error={errors.buyerType?.message}>
            <select {...register('buyerType')} style={input}>
              <option value="Local">Local</option>
              <option value="Export">Export</option>
            </select>
          </Field>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
            <button type="button" onClick={onClose} style={btnSecondary}>Cancel</button>
            <button type="submit" disabled={isSubmitting} style={btnPrimary}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; error?: string; children: React.ReactNode }> = ({
  label, error, children,
}) => (
  <div style={{ marginBottom: 12 }}>
    <label style={{ display: 'block', fontWeight: 'bold', fontSize: 13, marginBottom: 4 }}>
      {label}
    </label>
    {children}
    {error && <div style={{ color: '#c62828', fontSize: 12, marginTop: 3 }}>{error}</div>}
  </div>
);

const backdrop: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
};
const modal: React.CSSProperties = {
  background: '#fff', padding: 25, borderRadius: 10, width: 480,
  maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.15)',
};
const input: React.CSSProperties = {
  width: '100%', padding: 8, borderRadius: 6, border: '1px solid #ccc', boxSizing: 'border-box',
};
const iconBtn: React.CSSProperties = {
  background: 'transparent', border: 'none', cursor: 'pointer', padding: 4,
};
const btnPrimary: React.CSSProperties = {
  background: '#1565c0', color: '#fff', border: 'none', padding: '10px 16px',
  borderRadius: 6, cursor: 'pointer', fontWeight: 'bold',
};
const btnSecondary: React.CSSProperties = {
  background: '#eee', color: '#333', border: 'none', padding: '10px 16px',
  borderRadius: 6, cursor: 'pointer',
};

export default BuyerFormModal;