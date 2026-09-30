import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { staffApi, STAFF_TYPE_LABELS, type StaffActivityEntry, type StaffActivitySummary } from './staffApi';
import { INVENTORY_STATUS_LABELS, isInventoryStatus } from '../processing/processingEnums';
import { getApiErrorMessage } from '../processing/utils/apiError';
import { formatDateTime, formatMoney } from '../processing/utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Modal,
  PageHeader,
  btnSecondary,
  btnSmall,
  tableCellClass,
  tableHeadClass,
} from '../processing/components';

const actionLabel = (action: string): string => {
  if (action === 'DismantleStep') return 'Dismantle step';
  if (action === 'LocationMoved') return 'Location moved';
  if (action === 'Received') return 'Received';
  return isInventoryStatus(action) ? `Status → ${INVENTORY_STATUS_LABELS[action]}` : action;
};

/** Admin only: what every staff member has done, built from the existing audit records. */
const StaffActivityPage: React.FC = () => {
  const [rows, setRows] = useState<StaffActivitySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState<StaffActivitySummary | null>(null);
  const [entries, setEntries] = useState<StaffActivityEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await staffApi.activity());
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load staff activity.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openStaff = async (s: StaffActivitySummary) => {
    setOpen(s);
    setEntries([]);
    setEntriesError(null);
    setEntriesLoading(true);
    try {
      setEntries(await staffApi.recentActivity(s.userId));
    } catch (e) {
      setEntriesError(getApiErrorMessage(e, 'Failed to load recent activity.'));
    } finally {
      setEntriesLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff work review"
        subtitle="What each management and worker staff member has recorded: receiving, dismantling, classification and payments."
        icon={ClipboardCheck}
        actions={
          <button type="button" onClick={load} className={btnSecondary} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      <GlassCard padded={false}>
        {error ? (
          <div className="p-5">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        ) : loading && rows.length === 0 ? (
          <LoadingState label="Loading staff activity…" />
        ) : rows.length === 0 ? (
          <EmptyState icon={ClipboardCheck} title="No staff yet" description="Add staff on the Staff page." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] border-collapse">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Staff member</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Received</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Extra-waste receipts</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Dismantle steps</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Classifications</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Payments raised</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Payments made</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Last activity</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`} />
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.userId} className={`border-b border-mint-50 last:border-0 ${s.isDeleted ? 'opacity-60' : ''}`}>
                    <td className={tableCellClass}>
                      <div className="font-semibold text-ink-900">
                        {s.fullName} {s.isDeleted && <span className="text-xs font-normal text-ink-600">(deleted)</span>}
                      </div>
                      <div className="text-[11px] text-ink-600">{STAFF_TYPE_LABELS[s.staffType]}</div>
                    </td>
                    <td className={`${tableCellClass} text-right font-mono`}>{s.itemsReceived}</td>
                    <td className={`${tableCellClass} text-right font-mono`}>{s.extraWasteReceipts}</td>
                    <td className={`${tableCellClass} text-right font-mono`}>{s.dismantleSteps}</td>
                    <td className={`${tableCellClass} text-right font-mono`}>{s.classifications}</td>
                    <td className={`${tableCellClass} text-right font-mono`}>{s.paymentsRaised}</td>
                    <td className={`${tableCellClass} text-right font-mono`}>
                      {s.paymentsPaid}
                      {s.paymentsPaid > 0 && <div className="text-[11px] text-ink-600">{formatMoney(s.amountPaid)}</div>}
                    </td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateTime(s.lastActivityAt)}</td>
                    <td className={`${tableCellClass} text-right`}>
                      <button type="button" className={`${btnSecondary} ${btnSmall}`} onClick={() => openStaff(s)}>
                        Recent work
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? `Recent work — ${open.fullName}` : ''}
        subtitle={open ? `${STAFF_TYPE_LABELS[open.staffType]} · ${open.totalInventoryActions} inventory actions in total` : undefined}
        size="lg"
      >
        {entriesError ? (
          <ErrorMessage message={entriesError} onRetry={() => open && openStaff(open)} />
        ) : entriesLoading ? (
          <LoadingState label="Loading…" />
        ) : entries.length === 0 ? (
          <p className="py-4 text-sm text-ink-600">No inventory actions recorded for this staff member.</p>
        ) : (
          <ol className="space-y-2">
            {entries.map((e, i) => (
              <li key={`${e.performedAt}-${i}`} className="rounded-xl bg-white/60 px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-900">
                    {actionLabel(e.action)} ·{' '}
                    <Link to={`/processing/inventory/${e.inventoryItemId}`} className="text-mint-700 hover:underline" onClick={() => setOpen(null)}>
                      {e.itemType ?? 'item'}
                    </Link>
                  </span>
                  <span className="text-xs text-ink-600">{formatDateTime(e.performedAt)}</span>
                </div>
                {e.notes && <p className="mt-0.5 text-xs text-ink-800">{e.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </Modal>
    </div>
  );
};

export default StaffActivityPage;
