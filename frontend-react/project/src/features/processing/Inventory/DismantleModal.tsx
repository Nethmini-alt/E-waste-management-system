import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { inventoryApi } from './inventoryApi';
import type { InventoryDetail } from './types';
import { INVENTORY_STATUS_LABELS, LIMITS } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { formatKg } from '../utils/format';
import { useItemTypes, useMaterialTypes } from '../hooks/useLookups';
import { ErrorMessage, Modal, Notice, SearchSelect, btnPrimary, btnSecondary, inputClass, labelClass } from '../components';

interface ChildRow {
  key: number;
  itemType: string;
  weightKg: string;
}

interface MaterialRow {
  key: number;
  materialType: string;
  weightKg: string;
  hazardous: boolean;
}

interface DismantleModalProps {
  open: boolean;
  item: InventoryDetail;
  onClose: () => void;
  onDone: (message: string) => void;
}

// Mirror of HazardousMaterialRules on the backend: these are held even if "hazardous" is not ticked.
const HAZARD_KEYWORDS = ['battery', 'batteries', 'lithium', 'li-ion', 'lead', 'mercury', 'crt', 'capacitor', 'toner', 'asbestos'];
const isKnownHazard = (materialType: string) => HAZARD_KEYWORDS.some((k) => materialType.toLowerCase().includes(k));

let rowKey = 0;
const newChild = (): ChildRow => ({ key: ++rowKey, itemType: '', weightKg: '' });
const newMaterial = (): MaterialRow => ({ key: ++rowKey, materialType: '', weightKg: '', hazardous: false });
const positive = (v: string) => (Number(v) > 0 ? Number(v) : 0);

const DismantleModal: React.FC<DismantleModalProps> = ({ open, item, onClose, onDone }) => {
  const itemTypes = useItemTypes();
  const materialTypes = useMaterialTypes();
  const [description, setDescription] = useState('');
  const [remainingWeight, setRemainingWeight] = useState('');
  const [children, setChildren] = useState<ChildRow[]>([]);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDescription('');
      setRemainingWeight('');
      setChildren([]);
      setMaterials([]);
      setSubmitted(false);
      setError(null);
    }
  }, [open]);

  const updateChild = (key: number, patch: Partial<ChildRow>) =>
    setChildren((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const updateMaterial = (key: number, patch: Partial<MaterialRow>) =>
    setMaterials((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const componentOptions = useMemo(() => itemTypes.data.map((t) => ({ value: t, label: t })), [itemTypes.data]);
  const materialOptions = useMemo(() => materialTypes.data.map((t) => ({ value: t, label: t })), [materialTypes.data]);

  // Weight is conserved, exactly as the backend enforces it: components + materials + remainder <= current
  // weight. With no remainder entered, the outputs are taken off the item automatically.
  const current = item.verifiedWeightKg;
  const childTotal = children.reduce((sum, c) => sum + positive(c.weightKg), 0);
  const materialTotal = materials.reduce((sum, m) => sum + positive(m.weightKg), 0);
  const outputsTotal = childTotal + materialTotal;
  const remainingEntered = remainingWeight !== '' && Number(remainingWeight) >= 0;
  const newWeight = remainingEntered ? Number(remainingWeight) : current - outputsTotal;
  const lossKg = current - outputsTotal - newWeight;
  // Small tolerance so 0.1 + 0.2 style float noise never blocks a valid entry.
  const overweight = outputsTotal + newWeight > current + 0.0005 || outputsTotal > current + 0.0005;

  // Field-level checks mirror AddDismantleLogRequestValidator and the service's weight rule.
  const problems = useMemo(() => {
    const out: string[] = [];
    if (!description.trim()) out.push('Describe what was done in this step.');
    if (description.length > LIMITS.notes) out.push(`Description must be ${LIMITS.notes} characters or fewer.`);
    if (remainingWeight !== '' && !(Number(remainingWeight) >= 0)) out.push('Remaining weight must be 0 or more.');
    children.forEach((c, i) => {
      if (!c.itemType) out.push(`Component ${i + 1}: choose a type from the list.`);
      if (!(Number(c.weightKg) > 0)) out.push(`Component ${i + 1}: weight must be greater than 0.`);
    });
    materials.forEach((m, i) => {
      if (!m.materialType) out.push(`Material ${i + 1}: choose a material from the list.`);
      if (!(Number(m.weightKg) > 0)) out.push(`Material ${i + 1}: weight must be greater than 0.`);
    });
    if (overweight) out.push(`Components, materials and the remaining weight can't be more than this item's current ${formatKg(current)}.`);
    return out;
  }, [description, remainingWeight, children, materials, overweight, current]);

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
        materials: materials.map((m) => ({ materialType: m.materialType, weightKg: Number(m.weightKg), hazardous: m.hazardous })),
      });
      const components = result.childInventoryItemIds.length;
      const recovered = result.materialInventoryItemIds.length;
      const outputs = [
        components > 0 ? `${components} component${components === 1 ? '' : 's'} recovered` : null,
        recovered > 0 ? `${recovered} material${recovered === 1 ? '' : 's'} recorded` : null,
      ].filter(Boolean);
      const loss = result.lossKg > 0 ? ` ${formatKg(result.lossKg)} recorded as loss.` : '';
      onDone(outputs.length > 0 ? `Dismantle step logged — ${outputs.join(', ')}.${loss}` : `Dismantle step logged.${loss}`);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to log the dismantle step.'));
    } finally {
      setSubmitting(false);
    }
  };

  const showPreview = children.length > 0 || materials.length > 0 || remainingEntered;

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
            Leave blank to subtract the components and materials automatically. If entered, any difference is recorded as loss (dust, screws, scrap).
          </p>
        </div>

        {/* Components */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={`${labelClass} !mb-0`}>Dismantled components (optional)</span>
            <button type="button" onClick={() => setChildren((rows) => [...rows, newChild()])} className="inline-flex items-center gap-1 text-xs font-semibold text-mint-700 hover:underline">
              <Plus size={12} /> Add component
            </button>
          </div>

          {children.length === 0 ? (
            <p className="rounded-xl border border-dashed border-mint-200 px-4 py-3 text-xs text-ink-600">
              Parts that should be tracked as their own inventory item (status Recovered), e.g. a battery pack or mainboard.
            </p>
          ) : (
            <div className="space-y-2">
              {children.map((c, i) => (
                <div key={c.key} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <SearchSelect
                    value={c.itemType}
                    onChange={(v) => updateChild(c.key, { itemType: v })}
                    options={componentOptions}
                    disabled={itemTypes.loading}
                    placeholder={itemTypes.loading ? 'Loading…' : `Component ${i + 1} — type to search…`}
                    emptyText="Not on the item-type list"
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
          {itemTypes.error && <ErrorMessage className="mt-2" message={itemTypes.error} onRetry={itemTypes.reload} />}
        </div>

        {/* Materials */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className={`${labelClass} !mb-0`}>Recovered materials (optional)</span>
            <button type="button" onClick={() => setMaterials((rows) => [...rows, newMaterial()])} className="inline-flex items-center gap-1 text-xs font-semibold text-mint-700 hover:underline">
              <Plus size={12} /> Add material
            </button>
          </div>

          {!materialTypes.loading && !materialTypes.error && materialTypes.data.length === 0 && (
            <Notice tone="warning" className="mb-2">
              No sellable materials are on the list yet (the list comes from material pricing), so none can be recorded.
            </Notice>
          )}

          {materials.length === 0 ? (
            <p className="rounded-xl border border-dashed border-mint-200 px-4 py-3 text-xs text-ink-600">
              Finished materials such as copper, aluminium or circuit boards go straight to Ready for sale. Hazardous materials (batteries, lead, mercury, CRT glass…) are put On hold instead.
            </p>
          ) : (
            <div className="space-y-3">
              {materials.map((m, i) => {
                const knownHazard = isKnownHazard(m.materialType);
                return (
                  <div key={m.key}>
                    <div className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                      <SearchSelect
                        value={m.materialType}
                        onChange={(v) => updateMaterial(m.key, { materialType: v })}
                        options={materialOptions}
                        disabled={materialTypes.loading}
                        placeholder={materialTypes.loading ? 'Loading…' : `Material ${i + 1} — type to search, e.g. "alu"`}
                        emptyText="Not on the sellable materials list"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={m.weightKg}
                        onChange={(e) => updateMaterial(m.key, { weightKg: e.target.value })}
                        placeholder="kg"
                        aria-label={`Material ${i + 1} weight in kg`}
                        className={inputClass}
                      />
                      <button
                        type="button"
                        onClick={() => setMaterials((rows) => rows.filter((r) => r.key !== m.key))}
                        aria-label={`Remove material ${i + 1}`}
                        className="rounded-full p-2 text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    {knownHazard ? (
                      <p className="mt-1 text-xs text-red-700">Known hazardous material — it will be put On hold, not offered for sale.</p>
                    ) : (
                      <label className="mt-1 flex items-center gap-2 text-xs text-ink-800">
                        <input
                          type="checkbox"
                          checked={m.hazardous}
                          onChange={(e) => updateMaterial(m.key, { hazardous: e.target.checked })}
                          className="h-3.5 w-3.5 accent-red-600"
                        />
                        Hazardous — hold it instead of selling
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {materialTypes.error && <ErrorMessage className="mt-2" message={materialTypes.error} onRetry={materialTypes.reload} />}
        </div>

        {showPreview && (
          <Notice tone={overweight ? 'error' : 'info'}>
            {overweight
              ? `Components and materials (${formatKg(outputsTotal)}) plus the remaining weight (${formatKg(Math.max(newWeight, 0))}) are more than this item's current ${formatKg(current)}.`
              : `This item will go from ${formatKg(current)} to ${formatKg(newWeight)}; components ${formatKg(childTotal)}${
                  materialTotal > 0 ? `; materials ${formatKg(materialTotal)}` : ''
                }${lossKg > 0.0005 ? `; loss ${formatKg(lossKg)}` : ''}.`}
          </Notice>
        )}

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
