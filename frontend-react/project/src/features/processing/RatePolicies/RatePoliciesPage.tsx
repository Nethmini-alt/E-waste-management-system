import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Search, Tag } from 'lucide-react';
import { lookupApi } from '../lookupApi';
import { ratePolicyApi } from './ratePolicyApi';
import RatePolicyFormModal from './RatePolicyFormModal';
import type { RatePolicy } from '../types';
import { JOB_PAYMENT_RATE_KEY } from '../processingEnums';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { useItemTypes, useRatePolicies } from '../hooks/useLookups';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDate, formatMoney } from '../utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Modal,
  Notice,
  PageHeader,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  inputClass,
  tableCellClass,
  tableHeadClass,
} from '../components';

type Filter = 'all' | 'active' | 'inactive';

type Dialog = { type: 'form'; policy: RatePolicy | null } | { type: 'deactivate'; policy: RatePolicy } | null;

const isJobRate = (p: RatePolicy): boolean => p.itemType.toLowerCase() === JOB_PAYMENT_RATE_KEY.toLowerCase();

/**
 * The rate policies that price collector payments. Staff see them read-only; Admins can add a rate,
 * revise one (the old row is kept as history), deactivate it, or restore an inactive one. The server
 * enforces all of this — the buttons are only hidden for Staff.
 */
const RatePoliciesPage: React.FC = () => {
  const user = useCurrentUser();
  const isAdmin = user?.role.toLowerCase() === 'admin';

  const [policies, setPolicies] = useState<RatePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');

  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // activeOnly=false: include inactive policies too, so the page shows the full history.
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

  // Grouped by item type; within a type the active rate first, then the newest history.
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return policies
      .filter((p) => (filter === 'all' ? true : filter === 'active' ? p.isActive : !p.isActive))
      .filter((p) => !q || p.itemType.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          a.itemType.localeCompare(b.itemType, undefined, { sensitivity: 'base' }) ||
          Number(b.isActive) - Number(a.isActive) ||
          b.effectiveFrom.localeCompare(a.effectiveFrom),
      );
  }, [policies, filter, search]);

  const activeCount = policies.filter((p) => p.isActive).length;

  // Only one active rate per type (ignoring case): an inactive row can be restored only when its type has none.
  const activeTypes = useMemo(() => new Set(policies.filter((p) => p.isActive).map((p) => p.itemType.toLowerCase())), [policies]);

  const afterChange = (message: string) => {
    setDialog(null);
    setActionError(null);
    setNotice(message);
    // Receive forms and dismantle dropdowns cache these lists; make them fetch again.
    useRatePolicies.invalidate();
    useItemTypes.invalidate();
    load();
  };

  const runAction = async (action: () => Promise<RatePolicy>, message: (saved: RatePolicy) => string) => {
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      afterChange(message(await action()));
    } catch (e) {
      setActionError(getApiErrorMessage(e, 'The change could not be saved.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Rate policies"
        subtitle={
          isAdmin
            ? 'What the system pays collectors per kilogram, by item type.'
            : 'What the system pays collectors per kilogram, by item type. Only an Admin can change rates.'
        }
        icon={Tag}
        actions={
          isAdmin && (
            <button type="button" className={btnPrimary} onClick={() => setDialog({ type: 'form', policy: null })}>
              <Plus size={15} /> Add rate
            </button>
          )
        }
      />

      {notice && (
        <Notice tone="success" className="mb-4">
          {notice}
        </Notice>
      )}
      {actionError && !dialog && <ErrorMessage className="mb-4" message={actionError} />}

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
        ) : loading && policies.length === 0 ? (
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
                  {isAdmin && <th className={`${tableHeadClass} px-4 py-3 text-right`}>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-mint-50 last:border-0">
                    <td className={tableCellClass}>
                      <span className="font-semibold text-ink-900">{p.itemType}</span>
                      {isJobRate(p) && (
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
                    {isAdmin && (
                      <td className={`${tableCellClass} whitespace-nowrap text-right`}>
                        {p.isActive ? (
                          <div className="inline-flex gap-1.5">
                            <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={() => setDialog({ type: 'form', policy: p })} disabled={busy}>
                              Revise
                            </button>
                            {!isJobRate(p) && (
                              <button
                                type="button"
                                className={`${btnSecondary} ${btnSmall}`}
                                onClick={() => {
                                  setActionError(null);
                                  setDialog({ type: 'deactivate', policy: p });
                                }}
                                disabled={busy}
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        ) : activeTypes.has(p.itemType.toLowerCase()) ? (
                          <span className="text-xs text-ink-600">History</span>
                        ) : (
                          <button
                            type="button"
                            className={`${btnSecondary} ${btnSmall}`}
                            onClick={() => runAction(() => ratePolicyApi.restore(p.id), (r) => `${r.itemType} is active again at ${formatMoney(r.ratePerKg)} per kg.`)}
                            disabled={busy}
                          >
                            Restore
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <RatePolicyFormModal
        open={dialog?.type === 'form'}
        policy={dialog?.type === 'form' ? dialog.policy : null}
        onClose={() => setDialog(null)}
        onDone={afterChange}
      />

      <Modal
        open={dialog?.type === 'deactivate'}
        onClose={() => setDialog(null)}
        title={dialog?.type === 'deactivate' ? `Deactivate ${dialog.policy.itemType}?` : ''}
        busy={busy}
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => setDialog(null)} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={btnDanger}
              disabled={busy}
              onClick={() => {
                if (dialog?.type !== 'deactivate') return;
                const { id } = dialog.policy;
                runAction(() => ratePolicyApi.deactivate(id), (r) => `${r.itemType} is no longer paid for. You can restore it later.`);
              }}
            >
              {busy ? 'Deactivating…' : 'Deactivate'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-800">
            Collectors can no longer be paid for this item type on extra-waste receipts, and it leaves the item-type lists unless Sales
            prices it as a material. Existing payments and inventory items are not changed. The rate stays in the history and can be restored.
          </p>
          {actionError && <ErrorMessage message={actionError} />}
        </div>
      </Modal>
    </div>
  );
};

export default RatePoliciesPage;
