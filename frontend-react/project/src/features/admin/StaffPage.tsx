import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, UserPlus, Users } from 'lucide-react';
import { staffApi, STAFF_TYPE_LABELS, type CreateStaffInput, type StaffMember, type StaffType } from './staffApi';
import { useCurrentUser } from '../processing/hooks/useCurrentUser';
import { getApiErrorMessage } from '../processing/utils/apiError';
import { formatDate } from '../processing/utils/format';
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
  labelClass,
  tableCellClass,
  tableHeadClass,
} from '../processing/components';

const EMPTY_FORM: CreateStaffInput = { fullName: '', email: '', phone: '', password: '', staffType: 'Worker' };

const StaffTypeBadge: React.FC<{ type: StaffType }> = ({ type }) => (
  <span
    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
      type === 'Worker' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'
    }`}
  >
    {STAFF_TYPE_LABELS[type]}
  </span>
);

/** Admin only: add and remove management staff (web) and worker staff (warehouse mobile app). */
const StaffPage: React.FC = () => {
  const me = useCurrentUser();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<CreateStaffInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStaff(await staffApi.list());
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load staff.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const set = (key: keyof CreateStaffInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setFormError(null);
    setAdding(true);
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      setFormError('The password must be at least 6 characters.');
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await staffApi.create(form);
      setAdding(false);
      setNotice(`${created.fullName} was added as ${STAFF_TYPE_LABELS[created.staffType].toLowerCase()}.`);
      load();
    } catch (err) {
      setFormError(getApiErrorMessage(err, 'The staff member could not be added.'));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await staffApi.remove(toDelete.userId);
      setNotice(`${toDelete.fullName} was removed. Their past work stays visible in Staff Work Review.`);
      setToDelete(null);
      load();
    } catch (err) {
      setDeleteError(getApiErrorMessage(err, 'The staff member could not be removed.'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle="Management staff use this website. Worker staff use only the warehouse mobile app for receiving and inventory work."
        icon={Users}
        actions={
          <>
            <button type="button" onClick={load} className={btnSecondary} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <button type="button" onClick={openAdd} className={btnPrimary}>
              <UserPlus size={14} /> Add staff
            </button>
          </>
        }
      />

      {notice && (
        <Notice tone="success" className="mb-4">
          {notice}
        </Notice>
      )}

      <GlassCard padded={false}>
        {error ? (
          <div className="p-5">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        ) : loading && staff.length === 0 ? (
          <LoadingState label="Loading staff…" />
        ) : staff.length === 0 ? (
          <EmptyState icon={Users} title="No staff yet" description="Add management or worker staff to get started." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Name</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Type</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Email</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Phone</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Added</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.userId} className="border-b border-mint-50 last:border-0">
                    <td className={`${tableCellClass} font-semibold text-ink-900`}>{s.fullName}</td>
                    <td className={tableCellClass}>
                      <StaffTypeBadge type={s.staffType} />
                    </td>
                    <td className={tableCellClass}>{s.email}</td>
                    <td className={tableCellClass}>{s.phone || '—'}</td>
                    <td className={`${tableCellClass} whitespace-nowrap`}>{formatDate(s.createdAt)}</td>
                    <td className={`${tableCellClass} text-right`}>
                      {s.userId !== me?.userId && (
                        <button
                          type="button"
                          className={`${btnSecondary} ${btnSmall}`}
                          onClick={() => {
                            setDeleteError(null);
                            setToDelete(s);
                          }}
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add staff member"
        busy={saving}
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" form="add-staff-form" className={btnPrimary} disabled={saving}>
              {saving ? 'Adding…' : 'Add staff member'}
            </button>
          </>
        }
      >
        <form id="add-staff-form" onSubmit={submitAdd} className="space-y-4">
          <div>
            <label className={labelClass} htmlFor="staff-type">Staff type</label>
            <select id="staff-type" value={form.staffType} onChange={set('staffType')} className={inputClass}>
              <option value="Worker">Worker staff — warehouse mobile app</option>
              <option value="Management">Management staff — website</option>
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="staff-name">Full name</label>
            <input id="staff-name" value={form.fullName} onChange={set('fullName')} required maxLength={150} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="staff-email">Email</label>
            <input id="staff-email" type="email" value={form.email} onChange={set('email')} required maxLength={255} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="staff-phone">Phone (optional)</label>
            <input id="staff-phone" value={form.phone} onChange={set('phone')} maxLength={20} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="staff-password">Temporary password</label>
            <input
              id="staff-password"
              type="password"
              value={form.password}
              onChange={set('password')}
              required
              minLength={6}
              autoComplete="new-password"
              className={inputClass}
            />
          </div>
          {formError && <ErrorMessage message={formError} />}
        </form>
      </Modal>

      <Modal
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="Delete staff member"
        size="sm"
        busy={deleting}
        footer={
          <>
            <button type="button" className={btnSecondary} onClick={() => setToDelete(null)} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className={btnDanger} onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-ink-800">
            <strong>{toDelete?.fullName}</strong> will no longer be able to sign in. Everything they already recorded
            (receipts, dismantling, classifications, payments) stays in the system and in Staff Work Review.
          </p>
          {deleteError && <ErrorMessage message={deleteError} />}
        </div>
      </Modal>
    </div>
  );
};

export default StaffPage;
