/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'Household' | 'Corporate' | 'Collector'>('Household');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/auth/register', {
        fullName, email, password, phone, role,
      });
      // Auto-login after successful register
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <form onSubmit={onSubmit} style={styles.card}>
        <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserPlus size={22} /> Create Account
        </h2>

        <label style={styles.label}>Full Name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)}
          required style={styles.input} />

        <label style={styles.label}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          required style={styles.input} />

        <label style={styles.label}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          required minLength={6} style={styles.input} />

        <label style={styles.label}>Phone (optional)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)}
          style={styles.input} />

        <label style={styles.label}>I am a…</label>
        <select value={role} onChange={(e) => setRole(e.target.value as any)} style={styles.input}>
          <option value="Household">Household</option>
          <option value="Corporate">Corporate</option>
          <option value="Collector">Collector</option>
        </select>

        {error && (
          <div style={styles.error}><AlertCircle size={16} /> {error}</div>
        )}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Creating account…' : 'Create Account'}
        </button>

        <p style={{ marginTop: 15, fontSize: 13, textAlign: 'center' }}>
          Want to buy recovered materials?{' '}
          <Link to="/register/buyer" style={{ color: '#1565c0' }}>Register as a Buyer</Link>
        </p>

        <p style={{ fontSize: 13, textAlign: 'center', marginBottom: 0 }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#1565c0' }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center', background: '#f4f6f8', fontFamily: 'Arial, sans-serif',
  },
  card: {
    background: '#fff', padding: 30, borderRadius: 10, width: 380,
    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
  },
  label: { display: 'block', fontWeight: 'bold', marginBottom: 6, marginTop: 12 },
  input: {
    width: '100%', padding: 10, borderRadius: 6, border: '1px solid #ccc',
    boxSizing: 'border-box',
  },
  button: {
    marginTop: 20, width: '100%', padding: '12px', background: '#1565c0',
    color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer',
    fontWeight: 'bold',
  },
  error: {
    marginTop: 15, padding: 10, background: '#ffebee', color: '#c62828',
    borderRadius: 6, fontSize: 14, display: 'flex', gap: 6, alignItems: 'center',
  },
};

export default RegisterPage;