/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X } from 'lucide-react';

const schema = z.object({
  materialType: z.string().min(1, 'Required').max(100),
  pricePerKg: z.coerce.number().positive('Must be greater than 0').max(1_000_000, 'Too high'),
  effectiveDate: z.string().min(1, 'Required'),
  expiryDate: z.string().optional(),
})

.refine(
    (v) => !v.expiryDate || new Date(v.expiryDate) > new Date(v.effectiveDate),
    {
      message: 'Expiry must be after effective date',
      path: ['expiryDate'],
    }
  );

export type MaterialPricingFormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (values: MaterialPricingFormValues) => Promise<void>;
  initial?: Partial<MaterialPricingFormValues>;
  title: string;
}

const MaterialPricingFormModal: React.FC<Props> = ({
  open,
  onClose,
  onSubmit,
  initial,
  title,
}) => {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MaterialPricingFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      materialType: '',
      pricePerKg: 0,
      effectiveDate: new Date().toISOString().slice(0, 10),
      expiryDate: '',
      ...initial,
    },
  });

  const handleFormSubmit: SubmitHandler<MaterialPricingFormValues> = async (
    values
  ) => {
    await onSubmit(values);
  };

  useEffect(() => {
    if (open && initial) {
      reset(initial as MaterialPricingFormValues);
    }
  }, [open, initial, reset]);

  if (!open) return null;

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button onClick={onClose} style={iconBtn}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit(handleFormSubmit)} style={{ marginTop: 15 }}>
          <Field label="Material Type" error={errors.materialType?.message}>
            <input
              {...register('materialType')}
              style={input}
              placeholder="e.g. Copper, Aluminium, PCB"
            />
          </Field>

          <Field label="Price per Kg (Rs.)" error={errors.pricePerKg?.message}>
            <input
              type="number"
              step="0.01"
              {...register('pricePerKg')}
              style={input}
            />
          </Field>

          <Field label="Effective Date" error={errors.effectiveDate?.message}>
            <input type="date" {...register('effectiveDate')} style={input} />
          </Field>

          <Field label="Expiry Date (optional)" error={errors.expiryDate?.message}>
            <input type="date" {...register('expiryDate')} style={input} />
          </Field>

          <div
            style={{
              display: 'flex',
              gap: 8,
              justifyContent: 'flex-end',
              marginTop: 20,
            }}
          >
            <button type="button" onClick={onClose} style={btnSecondary}>
              Cancel
            </button>
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
  label,
  error,
  children,
}) => (
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
    {error && (
      <div style={{ color: '#c62828', fontSize: 12, marginTop: 3 }}>{error}</div>
    )}
  </div>
);

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
  width: 440,
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
};
const btnSecondary: React.CSSProperties = {
  background: '#eee',
  color: '#333',
  border: 'none',
  padding: '10px 16px',
  borderRadius: 6,
  cursor: 'pointer',
};

export default MaterialPricingFormModal;
