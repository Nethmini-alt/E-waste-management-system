import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import type { InventoryDetail, ValidateClassificationResponse } from './types';
import {
  CLASSIFICATION_CATEGORIES,
  CLASSIFICATION_CATEGORY_LABELS,
  CLASSIFICATION_SOURCES,
  CLASSIFICATION_SOURCE_LABELS,
  INVENTORY_STATUS_LABELS,
  LIMITS,
  LOW_CONFIDENCE_THRESHOLD,
  type ClassificationCategory,
  type ClassificationSource,
} from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { ErrorMessage, Modal, Notice, btnDanger, btnPrimary, btnSecondary, inputClass, labelClass } from '../components';

const CATEGORY_HELP: Record<ClassificationCategory, string> = {
  Reusable: 'Can be refurbished or reused as it is.',
  LocalRecyclable: 'Can be recycled through local partners.',
  Hazardous: 'Contains hazardous material (batteries, CRT glass, mercury, lead…). Quarantined automatically.',
  ExportOnly: 'Can only be handled through export channels.',
};

interface ClassifyModalProps {
  open: boolean;
  item: InventoryDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

const ClassifyModal: React.FC<ClassifyModalProps> = ({ open, item, onClose, onDone }) => {
  const [category, setCategory] = useState<ClassificationCategory | null>(null);
  const [subCategory, setSubCategory] = useState('');
  const [source, setSource] = useState<ClassificationSource>('Manual');
  const [confidence, setConfidence] = useState('');
  const [isFinal, setIsFinal] = useState(true);

  const [validation, setValidation] = useState<ValidateClassificationResponse | null>(null);
  const [validatedKey, setValidatedKey] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [validating, setValidating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCategory(null);
      setSubCategory('');
      setSource('Manual');
      setConfidence('');
      setIsFinal(true);
      setValidation(null);
      setValidatedKey(null);
      setAck(false);
      setError(null);
    }
  }, [open]);

  // What the validate endpoint sees. If any of it changes after validating, the result is stale.
  const inputKey = `${category ?? ''}|${subCategory.trim()}|${confidence.trim()}`;
  const validationIsCurrent = validation !== null && validatedKey === inputKey;
  const isHazardous = category === 'Hazardous';

  const confidenceNum = confidence.trim() === '' ? undefined : Number(confidence);
  const inputProblem = useMemo(() => {
    if (subCategory.length > LIMITS.subCategory) return `Sub-category must be ${LIMITS.subCategory} characters or fewer.`;
    if (confidenceNum !== undefined && !(confidenceNum >= 0 && confidenceNum <= 1)) return 'Confidence must be between 0 and 1.';
    return null;
  }, [subCategory, confidenceNum]);

  const needsAck = validationIsCurrent && (validation.requiresHumanReview || isHazardous);
  const canValidate = category !== null && !inputProblem && !validating && !submitting;
  const canConfirm = validationIsCurrent && validation.approved && (!needsAck || ack) && !submitting;

  const runValidation = async () => {
    if (!category) return;
    setValidating(true);
    setError(null);
    setAck(false);
    try {
      const result = await inventoryApi.validateClassification(item.id, {
        proposedCategory: category,
        proposedSubCategory: subCategory,
        confidenceScore: confidenceNum,
      });
      setValidation(result);
      setValidatedKey(inputKey);
    } catch (e) {
      setValidation(null);
      setValidatedKey(null);
      setError(getApiErrorMessage(e, 'Validation failed.'));
    } finally {
      setValidating(false);
    }
  };

  const confirm = async () => {
    if (!category || !canConfirm) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await inventoryApi.classify(item.id, {
        category,
        subCategory,
        source,
        confidenceScore: confidenceNum,
        isFinal,
      });
      onDone(
        result.status === 'OnHold'
          ? `Classified as ${CLASSIFICATION_CATEGORY_LABELS[result.category]} — the item was automatically moved to On hold.`
          : `Classified as ${CLASSIFICATION_CATEGORY_LABELS[result.category]}.`,
      );
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to classify the item.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Classify item"
      subtitle={`${item.itemType} · ${INVENTORY_STATUS_LABELS[item.status]}`}
      size="lg"
      busy={submitting || validating}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className={btnSecondary} onClick={runValidation} disabled={!canValidate}>
            {validating ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Validating…
              </>
            ) : validationIsCurrent ? (
              'Re-run validation'
            ) : (
              '1 · Validate classification'
            )}
          </button>
          <button type="button" className={isHazardous ? btnDanger : btnPrimary} onClick={confirm} disabled={!canConfirm}>
            {submitting ? 'Saving…' : isHazardous ? '2 · Classify & put on hold' : '2 · Classify item'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <p className="text-sm text-ink-800">
          Pick a category, then validate it. The classification can only be saved once the validation check has approved it.
        </p>

        {/* Category */}
        <fieldset>
          <legend className={labelClass}>Category</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {CLASSIFICATION_CATEGORIES.map((c) => {
              const selected = category === c;
              const hazard = c === 'Hazardous';
              return (
                <label
                  key={c}
                  className={[
                    'flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition',
                    selected
                      ? hazard
                        ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                        : 'border-mint-400 bg-mint-50 ring-2 ring-mint-200'
                      : 'border-mint-100 bg-white/60 hover:bg-mint-50/60',
                  ].join(' ')}
                >
                  <input type="radio" name="category" value={c} checked={selected} onChange={() => setCategory(c)} className="mt-1 accent-emerald-600" />
                  <span>
                    <span className={`flex items-center gap-1 text-sm font-semibold ${hazard ? 'text-red-800' : 'text-ink-900'}`}>
                      {hazard && <ShieldAlert size={14} />}
                      {CLASSIFICATION_CATEGORY_LABELS[c]}
                    </span>
                    <span className="block text-xs text-ink-600">{CATEGORY_HELP[c]}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {isHazardous && (
          <Notice tone="error" title="Hazardous items are quarantined automatically">
            As soon as this item is classified as Hazardous, the system moves it to <strong>On hold</strong> in the same step. On hold is final — the item can never be marked ready for sale or export.
          </Notice>
        )}

        {/* Details */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="cl-sub">
              Sub-category (optional)
            </label>
            <input
              id="cl-sub"
              value={subCategory}
              onChange={(e) => setSubCategory(e.target.value)}
              className={inputClass}
              placeholder="e.g. Lithium-ion battery"
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="cl-source">
              Classified by
            </label>
            <select id="cl-source" value={source} onChange={(e) => setSource(e.target.value as ClassificationSource)} className={inputClass}>
              {CLASSIFICATION_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {CLASSIFICATION_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass} htmlFor="cl-conf">
              Confidence (0 – 1, optional)
            </label>
            <input
              id="cl-conf"
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className={inputClass}
              placeholder={source === 'Ai' ? 'e.g. 0.92' : 'Usually blank for manual'}
            />
            <p className="mt-1 text-[11px] text-ink-600">Below {LOW_CONFIDENCE_THRESHOLD} is flagged for human review.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-800 sm:col-span-2">
            <input type="checkbox" checked={isFinal} onChange={(e) => setIsFinal(e.target.checked)} className="accent-emerald-600" />
            Mark this as the final classification
          </label>
        </div>

        {inputProblem && <Notice tone="error">{inputProblem}</Notice>}

        {/* Validation result */}
        {validation && !validationIsCurrent && (
          <Notice tone="info">You changed the classification after validating — run the validation again before saving.</Notice>
        )}

        {validationIsCurrent && !validation.approved && (
          <Notice tone="error" title="Validation rejected this classification">
            <ul className="list-disc pl-4">
              {validation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Notice>
        )}

        {validationIsCurrent && validation.approved && !validation.requiresHumanReview && (
          <Notice tone="success" title="Validation passed">
            <ul className="list-disc pl-4">
              {validation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Notice>
        )}

        {validationIsCurrent && validation.approved && validation.requiresHumanReview && (
          <Notice tone="warning" title="Approved, but flagged for human review">
            <ul className="list-disc pl-4">
              {validation.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </Notice>
        )}

        {needsAck && validation.approved && (
          <label className="flex cursor-pointer items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-sm text-ink-800">
            <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 accent-emerald-600" />
            <span>
              {validation.requiresHumanReview && 'I have reviewed the warnings above and want to classify this item anyway. '}
              {isHazardous && 'I understand the item will be moved to On hold automatically and cannot be released afterwards.'}
            </span>
          </label>
        )}

        {validationIsCurrent && validation.approved && !needsAck && (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-mint-700">
            <ShieldCheck size={14} /> Ready to save.
          </p>
        )}
        {!validationIsCurrent && category && !validating && (
          <p className="flex items-center gap-1.5 text-xs text-ink-600">
            <CheckCircle2 size={14} /> Run “Validate classification” to unlock saving.
          </p>
        )}

        {error && <ErrorMessage message={error} />}
      </div>
    </Modal>
  );
};

export default ClassifyModal;
