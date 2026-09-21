/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { LogIn, AlertCircle } from 'lucide-react';
import { useAuth } from './AuthContext';
import AuthShell from './AuthShell';

const inputClass =
  'w-full mt-1 px-4 py-2.5 rounded-xl border border-mint-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-mint-400 text-sm';

const LoginPage = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const registered = location.state?.registered;

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err?.response?.data?.message ?? 'Login failed. Check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Sign in" icon={LogIn}>
      <form onSubmit={onSubmit} className="mt-4">
        {registered && (
          <div className="mb-4 px-3 py-2 rounded-xl bg-mint-50 text-mint-700 text-xs font-mono">
            ✅ Account created! Sign in below.
          </div>
        )}

        <label className="text-xs font-mono uppercase text-ink-600">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          className={inputClass}
        />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          className={inputClass}
        />

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-glass w-full mt-6 py-3 rounded-full font-semibold text-sm disabled:opacity-60">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="mt-5 text-xs text-center text-ink-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-mint-700 font-semibold">Sign up</Link>
          {' · '}
          <Link to="/register/buyer" className="text-mint-700 font-semibold">Register as buyer</Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default LoginPage;
