/* eslint-disable no-unused-vars */
import React from 'react';
import { Link } from 'react-router-dom';

const defaultColumns = [
  {
    title: 'Product',
    links: [
      { label: 'How it works', href: '/welcome#how-it-works' },
      { label: 'Why us', href: '/welcome#why-us' },
      { label: 'E-waste & impact', to: '/impact' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Sign in', to: '/login' },
      { label: 'Create an account', to: '/register' },
      { label: 'Register as a buyer', to: '/register/buyer' },
    ],
  },
];

/** Shared footer for the public pages and the customer side of the app. */
export const SiteFooter = ({ columns = defaultColumns, inApp = false }) => (
  <footer className={`relative z-10 ${inApp ? 'mt-10' : 'px-4 pb-6 md:px-8'}`}>
    <div className="glass mx-auto max-w-6xl rounded-3xl px-8 py-10 md:px-12">
      <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="mb-3 flex items-center gap-2 font-display text-lg font-bold text-ink-900">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 text-white shadow-md shadow-mint-500/30">♻</div>
            E-Waste<span className="text-mint-600">.</span>
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-ink-600">
            Collect, process, submit and sell recovered materials — keeping e-waste out of landfill, one item at a time.
          </p>
        </div>
        {columns.map((col) => (
          <div key={col.title}>
            <h4 className="mb-3 font-mono text-xs font-bold uppercase tracking-widest text-ink-600">{col.title}</h4>
            <ul className="flex flex-col gap-2 text-sm">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.to ? (
                    <Link to={l.to} className="text-ink-800 transition-colors hover:text-mint-700">{l.label}</Link>
                  ) : (
                    <a href={l.href} className="text-ink-800 transition-colors hover:text-mint-700">{l.label}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-mint-100/70 pt-6 text-xs text-ink-600 sm:flex-row">
        <span>© {new Date().getFullYear()} E-Waste Management System</span>
        <span className="font-mono uppercase tracking-wide">Built for a cleaner supply chain</span>
      </div>
    </div>
  </footer>
);

export default SiteFooter;
