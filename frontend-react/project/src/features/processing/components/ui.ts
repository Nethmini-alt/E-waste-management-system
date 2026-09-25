/** Shared Tailwind class strings for Processing forms and buttons (mint / glass theme from theme.css). */

export const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-mint-100 bg-white/70 text-sm text-ink-900 placeholder:text-ink-600/50 ' +
  'focus:outline-none focus:ring-2 focus:ring-mint-400 disabled:opacity-60 disabled:cursor-not-allowed';

export const inputErrorClass = 'border-red-300 focus:ring-red-300';

export const labelClass = 'block text-xs font-mono uppercase tracking-wide text-ink-600 mb-1';

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold px-4 py-2.5 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed transition';

export const btnPrimary = `btn-glass ${btnBase}`;
export const btnSecondary = `btn-glass-light ${btnBase}`;
export const btnDanger = `${btnBase} bg-red-600 text-white shadow-md shadow-red-500/20 hover:bg-red-700 border-0`;
export const btnSmall = 'px-3 py-1.5 text-xs';

export const tableHeadClass = 'text-left text-[11px] font-mono uppercase tracking-wide text-ink-600';
export const tableCellClass = 'px-4 py-3 text-sm text-ink-800 align-middle';
