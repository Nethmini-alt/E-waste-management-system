import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import type { InventoryDetail } from './types';
import { INVENTORY_STATUS_LABELS, LIMITS } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { formatKg } from '../utils/format';
import { useItemTypes } from '../hooks/useLookups';
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
  const itemTypes = useItemTypes();
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

  // Weight is conserved, exactly as the backend enforces it: components + remainder <= current weight.
  // With no remainder entered, the components are taken off the item automatically.
  const current = item.verifiedWeightKg;
  const childTotal = children.reduce((sum, c) => sum + (Number(c.weightKg) > 0 ? Number(c.weightKg) : 0), 0);
  const remainingEntered = remainingWeight !== '' && Number(remainingWeight) >= 0;
  const newWeight = remainingEntered ? Number(remainingWeight) : current - childTotal;
  const lossKg = current - childTotal - newWeight;
  // Small tolerance so 0.1 + 0.2 style float noise never blocks a valid entry.
  const overweight = childTotal + newWeight > current + 0.0005 || childTotal > current + 0.0005;

  // Field-level checks mirror AddDismantleLogRequestValidator and the service's weight rule.
  const problems = useMemo(() => {
    const out: string[] = [];
    if (!description.trim()) out.push('Describe what was done in this step.');
    if (description.length > LIMITS.notes) out.push(`Description must be ${LIMITS.notes} characters or fewer.`);
    if (remainingWeight !== '' && !(Number(remainingWeight) >= 0)) out.push('Remaining weight must be 0 or more.');
    children.forEach((c, i) => {
      if (!c.itemType) out.push(`Child item ${i + 1}: choose an item type.`);
      if (!(Number(c.weightKg) > 0)) out.push(`Child item ${i + 1}: weight must be greater than 0.`);
    });
    if (overweight) out.push(`Components plus the remaining weight can't be more than this item's current ${formatKg(current)}.`);
    return out;
  }, [description, remainingWeight, children, overweight, current]);

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
      const loss = result.lossKg > 0 ? ` ${formatKg(result.lossKg)} recorded as loss.` : '';
      onDone(
        created > 0
          ? `Dismantle step logged — ${created} child item${created === 1 ? '' : 's'} created.${loss}`
          : `Dismantle step logged.${loss}`,
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
          <p className="mt-1 text-xs text-ink-600">
            Leave blank to subtract the components automatically. If entered, any difference is recorded as loss (dust, screws, scrap).
          </p>
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
              {children.map((c, i) => (
                <div key={c.key} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <select
                    value={c.itemType}
                    onChange={(e) => updateChild(c.key, { itemType: e.target.value })}
                    aria-label={`Component ${i + 1} type`}
                    className={inputClass}
                    disabled={itemTypes.loading}
                  >
                    <option value="">{itemTypes.loading ? 'Loading…' : `Component ${i + 1} type…`}</option>
                    {itemTypes.data.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
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

          {itemTypes.error && <ErrorMessage className="mt-2" message={itemTypes.error} onRetry={itemTypes.reload} />}

          {(children.length > 0 || remainingEntered) && (
            <Notice tone={overweight ? 'error' : 'info'} className="mt-3">
              {overweight
                ? `Components (${formatKg(childTotal)}) plus the remaining weight (${formatKg(Math.max(newWeight, 0))}) are more than this item's current ${formatKg(current)}.`
                : `This item will go from ${formatKg(current)} to ${formatKg(newWeight)}; components ${formatKg(childTotal)}${lossKg > 0.0005 ? `; loss ${formatKg(lossKg)}` : ''}.`}
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
