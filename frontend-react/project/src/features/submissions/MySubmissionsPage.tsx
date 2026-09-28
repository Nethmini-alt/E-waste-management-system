import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageSearch, RefreshCw, Send, Truck } from 'lucide-react';
import { submissionApi } from './submissionApi';
import { extractGeneralError } from './submissionErrors';
import type { SubmissionResponse } from './types';
import {
  EmptyState, ErrorMessage, GlassCard, LoadingState, PageHeader, StatusPill,
  btnPrimary, btnSecondary,
} from '../../components/ui';
import type { StatusTone } from '../../components/ui/StatusPill';

const STATUS_TONE: Record<string, StatusTone> = {
  CollectorAssigned: 'success',
  Collected: 'success',
  Rejected: 'error',
  Failed: 'error',
  Cancelled: 'error',
};

const MySubmissionsPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSubmissions(await submissionApi.mine());
    } catch (e) {
      setError(extractGeneralError(e));
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="My submissions"
        subtitle="Track the e-waste items you've submitted for collection."
        icon={PackageSearch}
        actions={
          <>
            <button onClick={load} className={btnSecondary}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <Link to="/submissions/new" className={btnPrimary}>
              <Send size={14} /> Submit new item
            </Link>
          </>
        }
      />

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !submissions.length ? (
          <LoadingState label="Loading submissions…" />
        ) : !error && submissions.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No submissions yet"
            description="You haven't submitted any items yet."
            action={
              <Link to="/submissions/new" className={btnPrimary}>
                <Send size={14} /> Submit your first item
              </Link>
            }
          />
        ) : !error && submissions.length > 0 ? (
          <div className="divide-y divide-mint-50">
            {submissions.map((sub) => (
              <div key={sub.id} className="flex flex-wrap items-center gap-4 p-5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-display font-bold text-ink-900">{sub.category}</h4>
                    <span className="flex-shrink-0 rounded-full bg-ink-100 px-2.5 py-0.5 font-mono text-[11px] text-ink-600">
                      {sub.id.substring(0, 8)}…
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-ink-600">{sub.pickupAddress}</p>
                  <p className="mt-1 text-xs text-ink-600/80">
                    {sub.items.length} item{sub.items.length === 1 ? '' : 's'} · Submitted{' '}
                    {new Date(sub.createdAt).toLocaleDateString()}
                  </p>
                  {sub.statusReason && (
                    <p className="mt-1.5 text-xs font-medium text-red-600">{sub.statusReason}</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <StatusPill label={sub.statusLabel} tone={STATUS_TONE[sub.status] ?? 'info'} />
                  {/* No submitter-facing job detail page exists yet (job detail
                      is Staff/Admin-only), so the job is surfaced as info here
                      rather than a link that would just redirect away. */}
                  {sub.jobId && (
                    <span className="flex items-center gap-1 text-xs text-ink-600">
                      <Truck size={12} /> Job #{sub.jobId.substring(0, 8)}… — {sub.jobStatus}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
};

export default MySubmissionsPage;
