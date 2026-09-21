/* eslint-disable no-unused-vars */
import React from 'react';
import { Link } from 'react-router-dom';
import Hero3D from '../../components/Hero3D';

/**
 * Shared full-screen background + glass "pop-up board" shell used by
 * Login / Register / RegisterBuyer, so every auth screen matches the
 * landing page: circuit texture, animated Hero3D e-waste field, glass card.
 */
export const AuthShell = ({ title, icon: Icon, children, wide = false }) => (
  <div className="relative min-h-screen flex items-center justify-center px-4 py-10 overflow-hidden">
    <div className="circuit-bg" />
    <div className="absolute inset-0 z-0">
      <Hero3D density="lite" />
    </div>
    <div className="bg-blob blob-1" />
    <div className="bg-blob blob-2" />
    <div className="bg-blob blob-3" />

    <Link
      to="/welcome"
      className="fixed top-6 left-6 z-20 flex items-center gap-2 text-ink-800 font-display font-bold text-sm"
    >
      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 flex items-center justify-center text-white text-sm shadow-lg shadow-mint-500/30">♻</div>
      E-Waste<span className="text-mint-600">.</span>
    </Link>

    <div className={`glass relative z-10 rounded-3xl p-8 w-full ${wide ? 'max-w-md' : 'max-w-sm'} max-h-[92vh] overflow-y-auto`}>
      <h2 className="font-display text-xl font-bold mb-1 flex items-center gap-2 text-ink-900">
        {Icon && <Icon size={20} className="text-mint-600" />}
        {title}
      </h2>
      {children}
    </div>
  </div>
);

export default AuthShell;
