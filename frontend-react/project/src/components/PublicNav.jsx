/* eslint-disable no-unused-vars */
import React from 'react';
import { Link } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';

/**
 * Floating glass pill nav for the public marketing pages (Landing, Impact).
 * Matches the rounded-pill language the rest of the site already uses for
 * buttons/badges, instead of a plain edge-to-edge bar.
 */
export const PublicNav = () => (
  <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
    <nav className="glass flex w-full max-w-4xl items-center justify-between gap-3 rounded-full py-2 pl-3 pr-2 md:gap-6 md:pl-4 md:pr-3">
      <Link to="/welcome" className="flex flex-shrink-0 items-center gap-2 font-display font-bold text-ink-900">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 text-sm text-white shadow-md shadow-mint-500/30">♻</div>
        <span className="hidden sm:inline">E-Waste<span className="text-mint-600">.</span></span>
      </Link>

      <div className="hidden items-center gap-6 text-sm font-semibold text-ink-800 md:flex">
        <a href="/welcome#how-it-works" className="transition-colors hover:text-mint-700">How it works</a>
        <a href="/welcome#why-us" className="transition-colors hover:text-mint-700">Why us</a>
        <Link to="/impact" className="transition-colors hover:text-mint-700">E-waste &amp; impact</Link>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        <Link to="/login" className="btn-glass-light flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold sm:px-4 sm:text-sm">
          <LogIn size={14} /> <span className="hidden sm:inline">Sign in</span>
        </Link>
        <Link to="/register" className="btn-glass flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-semibold sm:px-4 sm:text-sm">
          <UserPlus size={14} /> <span className="hidden sm:inline">Get started</span>
        </Link>
      </div>
    </nav>
  </div>
);

export default PublicNav;
