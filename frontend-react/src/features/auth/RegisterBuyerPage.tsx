/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';

const RegisterBuyerPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phoneNumber: '',
    companyName: '',
    contactPerson: '',
    address: '',
    buyerType: 'Local' as 'Local' | 'Export',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<any>) =>
    setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/buyers/register', form);
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err: any) {
      setError(err?.response?.data?.detail
        ?? err?.response?.data?.title
        ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <form onSubmit={onSubmit} style={styles.card}>
        <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={22} /> Register as Buyer
        </h2>
        <p style={{ color: '#666', fontSize: 13, marginTop: 0 }}>
          Creates your login and buyer profile. Staff will activate your account.
        </p>

        <label style={styles.label}>Your Name</label>
        <input value={form.fullName} onChange={set('fullName')} required style={styles.input} />

        <label style={styles.label}>Email</label>
        <input type="email" value={form.email} onChange={set('email')} required style={styles.input} />

        <label style={styles.label}>Password</label>
        <input type="password" value={form.password} onChange={set('password')}
          required minLength={6} style={styles.input} />

        <label style={styles.label}>Phone</label>
        <input value={form.phoneNumber} onChange={set('phoneNumber')} style={styles.input} />

        <label style={styles.label}>Company Name</label>
        <input value={form.companyName} onChange={set('companyName')} required style={styles.input} />

        <label style={styles.label}>Contact Person</label>
        <input value={form.contactPerson} onChange={set('contactPerson')} required style={styles.input} />

        <label style={styles.label}>Address</label>
        <textarea value={form.address} onChange={set('address')} rows={2} style={styles.input} />

        <label style={styles.label}>Buyer Type</label>
        <select value={form.buyerType} onChange={set('buyerType')} style={styles.input}>
          <option value="Local">Local</option>
          <option value="Export">Export</option>
        </select>

        {error && <div style={styles.error}><AlertCircle size={16} /> {error}</div>}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Creating account…' : 'Create Buyer Account'}
        </button>

        <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 0, marginTop: 15 }}>
          Already registered? <Link to="/login" style={{ color: '#1565c0' }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f4f6f8', fontFamily: 'Arial, sans-serif',
    padding: 20,
  },
  card: {
    background: '#fff', padding: 30, borderRadius: 10, width: 420,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    maxHeight: '95vh', overflowY: 'auto',
  },
  label: { display: 'block', fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
  input: {
    width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  button: {
    marginTop: 20, width: '100%', padding: 12, background: '#1565c0',
    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold',
  },
  error: {
    marginTop: 15, padding: 10, background: '#ffebee', color: '#c62828',
    borderRadius: 6, fontSize: 14, display: 'flex', gap: 6, alignItems: 'center',
  },
};

export default RegisterBuyerPage;