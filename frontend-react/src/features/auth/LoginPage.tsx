/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const registered = (location.state as any)?.registered;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <form onSubmit={onSubmit} style={styles.card}>
        {registered && (
        <div style={{
          padding: 10, background: '#e8f5e9', color: '#2e7d32',
          borderRadius: 6, marginBottom: 12, fontSize: 13,
        }}>
          ✅ Account created! Sign in below.
        </div>
      )}

        <h2 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <LogIn size={22} /> Sign in
        </h2>

        <label style={styles.label}>Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          style={styles.input}
        />

        <label style={styles.label}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          style={styles.input}
        />

        {error && (
          <div style={styles.error}>
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={styles.button}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
        
        <p style={{ marginTop: 15, fontSize: 13, textAlign: 'center', marginBottom: 0 }}>
        Don't have an account?{' '}
        <Link to="/register" style={{ color: '#1565c0' }}>Sign up</Link>
        {' · '}
        <Link to="/register/buyer" style={{ color: '#1565c0' }}>Register as buyer</Link>
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
    background: '#fff', padding: 30, borderRadius: 10, width: 340,
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

export default LoginPage;