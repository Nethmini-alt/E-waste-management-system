import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, RefreshCw } from 'lucide-react';
import { agenticReviewApi } from './agenticReviewApi';
import { parseAnalyzerResult } from './parseWorkflow';
import WorkflowReviewModal from './WorkflowReviewModal';
import { IN_PROGRESS_STATUSES, WORKFLOW_STATUS_LABELS, type WorkflowStatus, type WorkflowSummary } from './types';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, shortId } from '../utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Notice,
  PageHeader,
  StatusBadge,
  btnSecondary,
  btnSmall,
  tableCellClass,
  tableHeadClass,
} from '../components';

type Tab = 'review' | 'progress' | 'done' | 'closed' | 'all';

const TABS: { id: Tab; label: string; match: (w: WorkflowSummary) => boolean }[] = [
  { id: 'review', label: 'Needs review', match: (w) => w.status === 'PendingApproval' },
  { id: 'progress', label: 'In progress', match: (w) => IN_PROGRESS_STATUSES.includes(w.status) },
  { id: 'done', label: 'Completed', match: (w) => w.status === 'Completed' },
  { id: 'closed', label: 'Rejected / failed', match: (w) => w.status === 'Rejected' || w.status === 'Failed' },
  { id: 'all', label: 'All', match: () => true },
];

const statusLabel = (s: string): string => WORKFLOW_STATUS_LABELS[s as WorkflowStatus] ?? s;

/**
 * Human-validation view of the EXISTING intake workflow (Planner → Analyzer → Validator → Matcher).
 * Nothing here starts or changes an agent; a reviewer reads the results and, if an Admin, approves or
 * rejects a workflow that is waiting for a decision.
 */
const AgenticReviewPage: React.FC = () => {
  const user = useCurrentUser();
  const isAdmin = user?.role.toLowerCase() === 'admin';

  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('review');
  const [openId, setOpenId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setWorkflows(await agenticReviewApi.list());
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load the workflows.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => Object.fromEntries(TABS.map((t) => [t.id, workflows.filter(t.match).length])) as Record<Tab, number>, [workflows]);
  const activeTab = TABS.find((t) => t.id === tab)!;
  const rows = useMemo(() => workflows.filter(activeTab.match), [workflows, activeTab]);
  const opened = workflows.find((w) => w.workflowId === openId) ?? null;

  return (
    <div>
      <PageHeader
        title="Agentic review"
        subtitle="Results of the intake AI workflow, and the cases that need a human decision."
        icon={Bot}
        actions={
          <button type="button" onClick={load} className={btnSecondary} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        }
      />

      {notice && (
        <Notice tone="success" className="mb-4">
          {notice}
        </Notice>
      )}

      {!isAdmin && (
        <Notice tone="info" className="mb-4">
          You can review every workflow, but only an Admin can approve or reject one.
        </Notice>
      )}

      <GlassCard className="mb-4">
        <div role="tablist" aria-label="Workflow status" className="flex flex-wrap gap-1.5">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  active ? 'bg-mint-600 text-white shadow-md shadow-mint-500/30' : 'text-ink-800 hover:bg-mint-50'
                }`}
              >
                {t.label}
                <span className={`rounded-full px-1.5 text-[11px] ${active ? 'bg-white/25' : 'bg-ink-100'} ${t.id === 'review' && counts.review > 0 && !active ? '!bg-amber-100 text-amber-800' : ''}`}>
                  {counts[t.id]}
                </span>
              </button>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard padded={false}>
        {error ? (
          <div className="p-5">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        ) : loading && workflows.length === 0 ? (
          <LoadingState label="Loading workflows…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Bot}
            title={tab === 'review' ? 'Nothing needs review' : 'No workflows here'}
            description={tab === 'review' ? 'When the validator flags a submission for a human decision, it appears here.' : 'No workflow matches this filter.'}
          />
        ) : (
          <div className={`overflow-x-auto transition-opacity ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Submission</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Status</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Human review</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Analyzer result</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Created</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Updated</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((w) => {
                  const analyzer = parseAnalyzerResult(w.analyzerResultJson);
                  return (
                    <tr
                      key={w.workflowId}
                      onClick={() => setOpenId(w.workflowId)}
                      className="cursor-pointer border-b border-mint-50 transition-colors last:border-0 hover:bg-mint-50/70"
                    >
                      <td className={tableCellClass}>
                        <div className="font-mono text-xs text-ink-800" title={w.submissionId}>
                          {shortId(w.submissionId)}
                        </div>
                      </td>
                      <td className={tableCellClass}>
                        <StatusBadge status={w.status} label={statusLabel(w.status)} />
                      </td>
                      <td className={tableCellClass}>
                        {w.status === 'PendingApproval' ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Decision needed</span>
                        ) : w.approvalRequired ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">Was required</span>
                        ) : (
                          <span className="text-xs text-ink-600">Not required</span>
                        )}
                      </td>
                      <td className={tableCellClass}>
                        {analyzer ? (
                          <>
                            <div className="text-sm text-ink-900">{analyzer.wasteCategory ?? '—'}</div>
                            <div className="text-[11px] text-ink-600">
                              Hazard {analyzer.hazardLevel ?? '—'}
                              {analyzer.confidenceScore !== null && ` · ${Math.round(analyzer.confidenceScore * 100)}% confidence`}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-ink-600">No result yet</span>
                        )}
                      </td>
                      <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateTime(w.createdAt)}</td>
                      <td className={`${tableCellClass} whitespace-nowrap`}>{formatDateTime(w.updatedAt)}</td>
                      <td className={`${tableCellClass} text-right`}>
                        <button
                          type="button"
                          className={`${btnSecondary} ${btnSmall}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenId(w.workflowId);
                          }}
                        >
                          {w.status === 'PendingApproval' && isAdmin ? 'Review' : 'View'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      <WorkflowReviewModal
        workflow={opened}
        isAdmin={isAdmin}
        onClose={() => setOpenId(null)}
        onDecided={(message) => {
          setOpenId(null);
          setNotice(message);
          load();
        }}
      />
    </div>
  );
};

export default AgenticReviewPage;
