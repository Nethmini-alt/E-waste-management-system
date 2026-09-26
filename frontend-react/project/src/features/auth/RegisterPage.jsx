/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import AuthShell from './AuthShell';

const inputClass =
  'w-full mt-1 px-4 py-2.5 rounded-xl border border-mint-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-mint-400 text-sm';

const RegisterPage = () => {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('Household');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/auth/register', { fullName, email, password, phone, role });
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Create Account" icon={UserPlus} wide>
      <form onSubmit={onSubmit} className="mt-4">
        <label className="text-xs font-mono uppercase text-ink-600">Full Name</label>
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Phone (optional)</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">I am a…</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
          <option value="Household">Household</option>
          <option value="Corporate">Corporate</option>
          <option value="Collector">Collector</option>
        </select>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-glass w-full mt-6 py-3 rounded-full font-semibold text-sm disabled:opacity-60">
          {loading ? 'Creating account…' : 'Create Account'}
        </button>

        <p className="mt-5 text-xs text-center text-ink-600">
          Want to buy recovered materials?{' '}
          <Link to="/register/buyer" className="text-mint-700 font-semibold">Register as a Buyer</Link>
        </p>
        <p className="mt-1 text-xs text-center text-ink-600">
          Already have an account? <Link to="/login" className="text-mint-700 font-semibold">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default RegisterPage;
