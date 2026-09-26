import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import type { InventoryDetail, ProcessingLogEntry } from './types';
import { CLASSIFICATION_SOURCE_LABELS, INVENTORY_STATUS_LABELS, isInventoryStatus } from '../processingEnums';
import { formatDateTime, shortId } from '../utils/format';
import { CategoryBadge, GlassCard, Notice } from '../components';

interface OnHoldReviewPanelProps {
  item: InventoryDetail;
  history: ProcessingLogEntry[];
  currentUserId: string | undefined;
}

// History entries that explain how an item ended up on hold.
const RELEVANT_ACTIONS = new Set(['DismantleStep', 'Dismantling', 'Classified', 'OnHold']);

const actionLabel = (action: string): string => {
  if (action === 'DismantleStep') return 'Dismantle step';
  return isInventoryStatus(action) ? `Status → ${INVENTORY_STATUS_LABELS[action]}` : action;
};

/**
 * Read-only review of an item that is On hold: why it is held, how it was classified, and the
 * history that led there. It deliberately offers no release, reclassify or override — the backend
 * treats On hold as final, and this screen does not add a rule the backend does not have.
 */
const OnHoldReviewPanel: React.FC<OnHoldReviewPanelProps> = ({ item, history, currentUserId }) => {
  const classification = item.classification;
  const hazardous = classification?.category === 'Hazardous';

  // Newest OnHold entry = the one that put the item on hold.
  const holdEntry = [...history].reverse().find((h) => h.action === 'OnHold') ?? null;
  const relevant = history.filter((h) => RELEVANT_ACTIONS.has(h.action));
  const by = (id: string) => (id === currentUserId ? 'you' : `staff ${shortId(id)}`);

  return (
    <GlassCard className="border border-red-200 !bg-red-50/50">
      <h3 className="mb-3 flex items-center gap-2 font-display text-base font-bold text-red-900">
        <ShieldAlert size={18} /> Why is this item on hold?
      </h3>

      <div className="space-y-4">
        <div className="rounded-2xl bg-white/70 p-4">
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Reason</p>
          {hazardous ? (
            <p className="mt-1 text-sm text-ink-900">
              <strong>Automatic quarantine.</strong> The item was classified as <strong>Hazardous</strong>. The system puts every hazardous item on hold in the same step as the classification, so it can never be sold or exported.
            </p>
          ) : (
            <p className="mt-1 text-sm text-ink-900">
              <strong>Placed on hold manually</strong> by staff after it was classified.
            </p>
          )}
          <p className="mt-2 text-xs text-ink-600">
            {holdEntry ? (
              <>
                {formatDateTime(holdEntry.performedAt)} · by {by(holdEntry.performedByStaffId)}
                {holdEntry.notes ? <> · “{holdEntry.notes}”</> : <> · no note was recorded</>}
              </>
            ) : (
              'The hold entry could not be found in the history.'
            )}
          </p>
        </div>

        <div className="rounded-2xl bg-white/70 p-4">
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Classification</p>
          {classification ? (
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-ink-600">Category</dt>
                <dd>
                  <CategoryBadge category={classification.category} />
                  {classification.subCategory && <span className="ml-2 text-xs text-ink-800">{classification.subCategory}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-600">Classified by</dt>
                <dd className="text-ink-900">
                  {CLASSIFICATION_SOURCE_LABELS[classification.source]}
                  {classification.classifiedByStaffId ? ` · ${by(classification.classifiedByStaffId)}` : ''}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-600">Confidence</dt>
                <dd className="text-ink-900">{classification.confidenceScore === null ? 'Not recorded' : `${Math.round(classification.confidenceScore * 100)}%`}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-600">Final classification</dt>
                <dd className="text-ink-900">{classification.isFinal ? 'Yes' : 'No'}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs text-ink-600">Classified at</dt>
                <dd className="text-ink-900">{formatDateTime(classification.classifiedAt)}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-ink-600">No classification record exists for this item.</p>
          )}
          <p className="mt-3 text-xs text-ink-600">
            Human-review flags raised while classifying (for example low confidence) are <strong>not stored</strong> by the system, so they cannot be shown here.
          </p>
        </div>

        <div className="rounded-2xl bg-white/70 p-4">
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Relevant history</p>
          {relevant.length === 0 ? (
            <p className="mt-1 text-sm text-ink-600">No classification or hold history recorded.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {relevant.map((h, i) => (
                <li key={`${h.performedAt}-${i}`} className="text-sm">
                  <span className="font-semibold text-ink-900">{actionLabel(h.action)}</span>
                  <span className="text-xs text-ink-600">
                    {' '}
                    · {formatDateTime(h.performedAt)} · by {by(h.performedByStaffId)}
                  </span>
                  {h.notes && <p className="text-xs text-ink-800">{h.notes}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {item.jobId && (
          <p className="text-xs text-ink-600">
            This item came from a job collection. The intake analysis for that job, if any, is on the{' '}
            <Link to="/processing/agentic-review" className="font-semibold text-mint-700 hover:underline">
              Agentic Review
            </Link>{' '}
            page.
          </p>
        )}

        <Notice tone="info">
          Review is read-only. On hold is final in the current workflow: this screen does not release the item or change its classification.
        </Notice>
      </div>
    </GlassCard>
  );
};

export default OnHoldReviewPanel;
