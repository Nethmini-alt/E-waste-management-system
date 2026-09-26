import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import type { InventoryDetail } from './types';
import { INVENTORY_STATUS_LABELS, LIMITS, isReservedExtraWasteType } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { formatKg } from '../utils/format';
import { useRatePolicies } from '../hooks/useLookups';
import { ErrorMessage, Modal, Notice, btnPrimary, btnSecondary, inputClass, labelClass } from '../components';

interface ChildRow {
  key: number;
  itemType: string;
  weightKg: string;
}

interface DismantleModalProps {
  open: boolean;
  item: InventoryDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

let rowKey = 0;
const newRow = (): ChildRow => ({ key: ++rowKey, itemType: '', weightKg: '' });

const DismantleModal: React.FC<DismantleModalProps> = ({ open, item, onClose, onDone }) => {
  const rates = useRatePolicies();
  const [description, setDescription] = useState('');
  const [remainingWeight, setRemainingWeight] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDescription('');
      setRemainingWeight('');
      setChildren([]);
      setSubmitted(false);
      setError(null);
    }
  }, [open]);

  const updateChild = (key: number, patch: Partial<ChildRow>) =>
    setChildren((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Field-level checks mirror AddDismantleLogRequestValidator on the backend.
  const problems = useMemo(() => {
    const out: string[] = [];
    if (!description.trim()) out.push('Describe what was done in this step.');
    if (description.length > LIMITS.notes) out.push(`Description must be ${LIMITS.notes} characters or fewer.`);
    if (remainingWeight !== '' && !(Number(remainingWeight) >= 0)) out.push('Remaining weight must be 0 or more.');
    children.forEach((c, i) => {
      if (!c.itemType.trim()) out.push(`Child item ${i + 1}: enter an item type.`);
      if (c.itemType.length > LIMITS.childItemType) out.push(`Child item ${i + 1}: item type must be ${LIMITS.childItemType} characters or fewer.`);
      if (!(Number(c.weightKg) > 0)) out.push(`Child item ${i + 1}: weight must be greater than 0.`);
    });
    return out;
  }, [description, remainingWeight, children]);

  const childTotal = children.reduce((sum, c) => sum + (Number(c.weightKg) > 0 ? Number(c.weightKg) : 0), 0);
  const overweight = childTotal > item.verifiedWeightKg;

  const submit = async () => {
    setSubmitted(true);
    if (problems.length > 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await inventoryApi.addDismantleLog(item.id, {
        description,
        remainingWeightKg: remainingWeight === '' ? undefined : Number(remainingWeight),
        childItems: children.map((c) => ({ itemType: c.itemType, weightKg: Number(c.weightKg) })),
      });
      const created = result.childInventoryItemIds.length;
      onDone(
        created > 0
          ? `Dismantle step logged — ${created} child item${created === 1 ? '' : 's'} created.`
          : 'Dismantle step logged.',
      );
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to log the dismantle step.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add dismantle step"
      subtitle={`${item.itemType} · ${INVENTORY_STATUS_LABELS[item.status]} · ${formatKg(item.verifiedWeightKg)}`}
      size="lg"
      busy={submitting}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Log step'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {item.status === 'Sorting' && (
          <Notice tone="info">The first dismantle step also moves this item from Sorting to Dismantling.</Notice>
        )}

        <div>
          <label className={labelClass} htmlFor="dm-desc">
            What was done
          </label>
          <textarea
            id="dm-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
            placeholder="e.g. Removed the battery pack and separated the mainboard."
          />
        </div>

        <div>
          <label className={labelClass} htmlFor="dm-weight">
            Remaining weight of this item (kg, optional)
          </label>
          <input
            id="dm-weight"
            type="number"
            min="0"
            step="0.01"
            value={remainingWeight}
            onChange={(e) => setRemainingWeight(e.target.value)}
            className={inputClass}
            placeholder={`Currently ${item.verifiedWeightKg}`}
          />
          <p className="mt-1 text-xs text-ink-600">If entered, it replaces this item's weight after the components come off.</p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={`${labelClass} !mb-0`}>Components created (optional)</span>
            <button type="button" onClick={() => setChildren((rows) => [...rows, newRow()])} className="inline-flex items-center gap-1 text-xs font-semibold text-mint-700 hover:underline">
              <Plus size={12} /> Add component
            </button>
          </div>

          {children.length === 0 ? (
            <p className="rounded-xl border border-dashed border-mint-200 px-4 py-3 text-xs text-ink-600">
              No components added. Add one for each part that should be tracked as its own inventory item — it inherits this item's origin and location.
            </p>
          ) : (
            <div className="space-y-2">
              <datalist id="dm-types">
                {rates.data
                  .filter((r) => !isReservedExtraWasteType(r.itemType))
                  .map((r) => (
                    <option key={r.id} value={r.itemType} />
                  ))}
              </datalist>
              {children.map((c, i) => (
                <div key={c.key} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <input
                    list="dm-types"
                    value={c.itemType}
                    maxLength={LIMITS.childItemType}
                    onChange={(e) => updateChild(c.key, { itemType: e.target.value })}
                    placeholder={`Component ${i + 1} type`}
                    aria-label={`Component ${i + 1} type`}
                    className={inputClass}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={c.weightKg}
                    onChange={(e) => updateChild(c.key, { weightKg: e.target.value })}
                    placeholder="kg"
                    aria-label={`Component ${i + 1} weight in kg`}
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setChildren((rows) => rows.filter((r) => r.key !== c.key))}
                    aria-label={`Remove component ${i + 1}`}
                    className="rounded-full p-2 text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {overweight && (
            <Notice tone="warning" className="mt-3">
              The components total {formatKg(childTotal)}, which is more than this item's current weight of {formatKg(item.verifiedWeightKg)}. Check the weights before logging.
            </Notice>
          )}
        </div>

        {submitted && problems.length > 0 && (
          <Notice tone="error" title="Please fix the following">
            <ul className="list-disc pl-4">
              {problems.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Notice>
        )}
        {error && <ErrorMessage message={error} />}
      </div>
    </Modal>
  );
};

export default DismantleModal;
