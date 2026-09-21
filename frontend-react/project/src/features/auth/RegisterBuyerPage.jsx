/* eslint-disable no-unused-vars */
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Building2, AlertCircle } from 'lucide-react';
import { api } from '../../api/client';
import AuthShell from './AuthShell';

const inputClass =
  'w-full mt-1 px-4 py-2.5 rounded-xl border border-mint-100 bg-white/70 focus:outline-none focus:ring-2 focus:ring-mint-400 text-sm';

const RegisterBuyerPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phoneNumber: '',
    companyName: '',
    contactPerson: '',
    address: '',
    buyerType: 'Local',
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/api/buyers/register', form);
      navigate('/login', { replace: true, state: { registered: true } });
    } catch (err) {
      setError(err?.response?.data?.detail ?? err?.response?.data?.title ?? 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Register as Buyer" icon={Building2} wide>
      <p className="text-ink-600 text-xs mt-1 mb-4">
        Creates your login and buyer profile. Staff will activate your account.
      </p>
      <form onSubmit={onSubmit}>
        <label className="text-xs font-mono uppercase text-ink-600">Your Name</label>
        <input value={form.fullName} onChange={set('fullName')} required className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Email</label>
        <input type="email" value={form.email} onChange={set('email')} required className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Password</label>
        <input type="password" value={form.password} onChange={set('password')} required minLength={6} className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Phone</label>
        <input value={form.phoneNumber} onChange={set('phoneNumber')} className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Company Name</label>
        <input value={form.companyName} onChange={set('companyName')} required className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Contact Person</label>
        <input value={form.contactPerson} onChange={set('contactPerson')} required className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Address</label>
        <textarea value={form.address} onChange={set('address')} rows={2} className={inputClass} />

        <label className="text-xs font-mono uppercase text-ink-600 block mt-4">Buyer Type</label>
        <select value={form.buyerType} onChange={set('buyerType')} className={inputClass}>
          <option value="Local">Local</option>
          <option value="Export">Export</option>
        </select>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-glass w-full mt-6 py-3 rounded-full font-semibold text-sm disabled:opacity-60">
          {loading ? 'Creating account…' : 'Create Buyer Account'}
        </button>

        <p className="mt-5 text-xs text-center text-ink-600">
          Already registered? <Link to="/login" className="text-mint-700 font-semibold">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default RegisterBuyerPage;
