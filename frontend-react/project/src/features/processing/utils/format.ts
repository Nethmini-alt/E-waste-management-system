// Small display helpers shared by the Processing pages.

const CURRENCY_PREFIX = 'Rs.'; // same convention as the Sales pages

const moneyFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const weightFormat = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const formatMoney = (amount: number): string => `${CURRENCY_PREFIX} ${moneyFormat.format(amount)}`;

export const formatKg = (kg: number): string => `${weightFormat.format(kg)} kg`;

/**
 * ASP.NET serialises UTC DateTimes without a zone when their Kind is Unspecified. Treat any
 * zone-less timestamp as UTC so it is not silently shown in the wrong time.
 */
const parseApiDate = (iso: string): Date => {
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`);
};

export const formatDateTime = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = parseApiDate(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const d = parseApiDate(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

/** "3fa85f64…" — enough of a GUID to recognise it without filling the screen. */
export const shortId = (id: string | null | undefined): string => (id ? `${id.slice(0, 8)}…` : '—');

/** Signed difference with an explicit +, for weight discrepancies. */
export const formatSignedKg = (kg: number): string => `${kg > 0 ? '+' : ''}${weightFormat.format(kg)} kg`;
