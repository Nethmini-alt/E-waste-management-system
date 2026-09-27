import React, { useEffect, useState } from 'react';
import { inventoryApi } from './inventoryApi';
import type { InventoryDetail } from './types';
import type { WarehouseLocation } from '../types';
import { INVENTORY_STATUS_LABELS, LIMITS, SUGGESTED_LOCATION_FOR_STATUS, type InventoryStatus } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { ErrorMessage, Modal, Notice, btnDanger, btnPrimary, btnSecondary, inputClass, labelClass } from '../components';

interface Copy {
  title: string;
  description: string;
  confirm: string;
  danger?: boolean;
  warning?: string;
}

// What each manual transition means, so staff know what they are committing to.
const COPY: Partial<Record<InventoryStatus, Copy>> = {
  Sorting: {
    title: 'Start sorting',
    description: 'Moves the item from Received into Sorting so it can be dismantled or classified.',
    confirm: 'Start sorting',
  },
  ReadyForSale: {
    title: 'Mark ready for sale',
    description: 'Hands the classified item over for sale.',
    confirm: 'Mark ready for sale',
    warning: 'Ready for sale is final — the status cannot be changed afterwards (the location still can).',
  },
  ExportOnly: {
    title: 'Reserve for export',
    description: 'Reserves the export-grade item for export channels only.',
    confirm: 'Reserve for export',
    warning: 'Reserved for export is final — the status cannot be changed afterwards (the location still can).',
  },
  OnHold: {
    title: 'Put item on hold',
    description: 'Quarantines the item so it cannot be sold or exported.',
    confirm: 'Put on hold',
    danger: true,
    warning: 'On hold is final — there is no way to release the item afterwards from this system.',
  },
};

interface TransitionModalProps {
  open: boolean;
  item: InventoryDetail;
  nextStatus: InventoryStatus | null;
  locations: WarehouseLocation[];
  onClose: () => void;
  onDone: (message: string) => void;
}

const TransitionModal: React.FC<TransitionModalProps> = ({ open, item, nextStatus, locations, onClose, onDone }) => {
  const [notes, setNotes] = useState('');
  const [newLocationId, setNewLocationId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNotes('');
      // Pre-select the area this status belongs in (e.g. On hold -> Hazardous Hold Area); staff can change it.
      const suggestedName = nextStatus ? SUGGESTED_LOCATION_FOR_STATUS[nextStatus] : undefined;
      const suggested = suggestedName ? locations.find((l) => l.name.toLowerCase() === suggestedName.toLowerCase()) : undefined;
      setNewLocationId(suggested && suggested.id !== item.currentLocationId ? suggested.id : '');
      setError(null);
    }
  }, [open, nextStatus, locations, item.currentLocationId]);

  if (!nextStatus) return null;
  const copy = COPY[nextStatus] ?? {
    title: `Move to ${INVENTORY_STATUS_LABELS[nextStatus]}`,
    description: '',
    confirm: 'Confirm',
  };
  const notesTooLong = notes.length > LIMITS.notes;

  const submit = async () => {
    if (notesTooLong) return;
    setSubmitting(true);
    setError(null);
    try {
      await inventoryApi.transition(item.id, {
        nextStatus,
        notes,
        newLocationId: newLocationId || undefined,
      });
      onDone(`Status changed to “${INVENTORY_STATUS_LABELS[nextStatus]}”.`);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to change the status.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={copy.title}
      subtitle={`${item.itemType} · currently ${INVENTORY_STATUS_LABELS[item.status]}`}
      busy={submitting}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className={copy.danger ? btnDanger : btnPrimary} onClick={submit} disabled={submitting || notesTooLong}>
            {submitting ? 'Saving…' : copy.confirm}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {copy.description && <p className="text-sm text-ink-800">{copy.description}</p>}
        {copy.warning && <Notice tone={copy.danger ? 'error' : 'warning'}>{copy.warning}</Notice>}

        <div>
          <label className={labelClass} htmlFor="tr-notes">
            Notes (optional)
          </label>
          <textarea
            id="tr-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputClass}
            placeholder="Anything worth recording in the item's history…"
          />
          <p className={`mt-1 text-right text-[11px] ${notesTooLong ? 'text-red-600' : 'text-ink-600'}`}>
            {notes.length}/{LIMITS.notes}
          </p>
        </div>

        <div>
          <label className={labelClass} htmlFor="tr-location">
            Move to location (optional)
          </label>
          <select id="tr-location" value={newLocationId} onChange={(e) => setNewLocationId(e.target.value)} className={inputClass}>
            <option value="">Keep current location ({item.currentLocationName})</option>
            {locations
              .filter((l) => l.id !== item.currentLocationId)
              .map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
          </select>
        </div>

        {error && <ErrorMessage message={error} />}
      </div>
    </Modal>
  );
};

export default TransitionModal;
