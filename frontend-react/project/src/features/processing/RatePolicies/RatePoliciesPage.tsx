import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Tag } from 'lucide-react';
import { lookupApi } from '../lookupApi';
import type { RatePolicy } from '../types';
import { JOB_PAYMENT_RATE_KEY } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDate, formatMoney } from '../utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Notice,
  PageHeader,
  inputClass,
  tableCellClass,
  tableHeadClass,
} from '../components';

type Filter = 'all' | 'active' | 'inactive';

/**
 * Read-only view of the rate policies that price collector payments. Rates are not editable here
 * (or anywhere in this app yet); this page only lets staff see what the system pays per kg.
 */
const RatePoliciesPage: React.FC = () => {
  const [policies, setPolicies] = useState<RatePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // activeOnly=false: include inactive policies too, so the page shows the full picture.
      setPolicies(await lookupApi.ratePolicies(false));
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load the rate policies.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policies
      .filter((p) => (filter === 'all' ? true : filter === 'active' ? p.isActive : !p.isActive))
      .filter((p) => !q || p.itemType.toLowerCase().includes(q));
  }, [policies, filter, search]);

  const activeCount = policies.filter((p) => p.isActive).length;

  return (
    <div>
      <PageHeader title="Rate policies" subtitle="What the system pays collectors per kilogram, by item type. View only." icon={Tag} />

      <Notice tone="info" className="mb-4" title="How rates are used">
        Extra-waste payments are priced per accepted item at its item type's active rate. Job-collection payments use the{' '}
        <strong>{JOB_PAYMENT_RATE_KEY}</strong> rate for the weight part; it is not an item type and cannot be used on extra-waste receipts. A payment keeps the rates it was created with, so changing a rate never changes an existing payment.
      </Notice>

      <GlassCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[14rem] flex-1">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item type…"
              aria-label="Search item type"
              className={`${inputClass} pl-10`}
            />
          </div>
          <div role="tablist" aria-label="Status filter" className="flex gap-1.5">
            {(['all', 'active', 'inactive'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filter === f}
                onClick={() => setFilter(f)}
                className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                  filter === f ? 'bg-mint-600 text-white shadow-md shadow-mint-500/30' : 'text-ink-800 hover:bg-mint-50'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <span className="text-xs text-ink-600">
            {policies.length} polic{policies.length === 1 ? 'y' : 'ies'} · {activeCount} active
          </span>
        </div>
      </GlassCard>

      <GlassCard padded={false}>
        {error ? (
          <div className="p-5">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        ) : loading ? (
          <LoadingState label="Loading rate policies…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={Tag} title="No rate policies" description={policies.length === 0 ? 'No rate policies exist yet.' : 'No policy matches your filter.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Item type</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Rate per kg</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Effective from</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-mint-50 last:border-0">
                    <td className={tableCellClass}>
                      <span className="font-semibold text-ink-900">{p.itemType}</span>
                      {p.itemType === JOB_PAYMENT_RATE_KEY && (
                        <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-800">Job collections only</span>
                      )}
                    </td>
                    <td className={`${tableCellClass} text-right font-mono font-semibold`}>{formatMoney(p.ratePerKg)}</td>
                    <td className={tableCellClass}>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${p.isActive ? 'bg-mint-100 text-mint-800' : 'bg-ink-100 text-ink-600'}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${p.isActive ? 'bg-mint-500' : 'bg-ink-600'}`} />
                        {p.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDate(p.effectiveFrom)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default RatePoliciesPage;
