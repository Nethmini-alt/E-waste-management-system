import React, { useEffect, useState } from 'react';
import { inventoryApi } from './inventoryApi';
import type { InventoryDetail } from './types';
import type { WarehouseLocation } from '../types';
import { getApiErrorMessage } from '../utils/apiError';
import { EmptyState, ErrorMessage, Modal, btnPrimary, btnSecondary, inputClass, labelClass } from '../components';

interface MoveLocationModalProps {
  open: boolean;
  item: InventoryDetail;
  locations: WarehouseLocation[];
  onClose: () => void;
  onDone: (message: string) => void;
}

const MoveLocationModal: React.FC<MoveLocationModalProps> = ({ open, item, locations, onClose, onDone }) => {
  const [newLocationId, setNewLocationId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNewLocationId('');
      setError(null);
    }
  }, [open]);

  const options = locations.filter((l) => l.id !== item.currentLocationId);

  const submit = async () => {
    if (!newLocationId) return;
    setSubmitting(true);
    setError(null);
    try {
      await inventoryApi.moveLocation(item.id, newLocationId);
      const target = locations.find((l) => l.id === newLocationId)?.name ?? 'the new location';
      onDone(`Moved to ${target}.`);
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to move the item.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Move location"
      subtitle={`${item.itemType} · currently in ${item.currentLocationName}`}
      size="sm"
      busy={submitting}
      footer={
        <>
          <button type="button" className={btnSecondary} onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className={btnPrimary} onClick={submit} disabled={submitting || !newLocationId}>
            {submitting ? 'Moving…' : 'Move item'}
          </button>
        </>
      }
    >
      {options.length === 0 ? (
        <EmptyState title="No other locations" description="There is no other warehouse location to move this item to." />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-800">
            Items can be moved at any stage, including after they are ready for sale. The move is written to the item's history.
          </p>
          <div>
            <label className={labelClass} htmlFor="mv-location">
              New location
            </label>
            <select id="mv-location" value={newLocationId} onChange={(e) => setNewLocationId(e.target.value)} className={inputClass}>
              <option value="">Select a location…</option>
              {options.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            {newLocationId && (
              <p className="mt-1 text-xs text-ink-600">{options.find((l) => l.id === newLocationId)?.description}</p>
            )}
          </div>
          {error && <ErrorMessage message={error} />}
        </div>
      )}
    </Modal>
  );
};

export default MoveLocationModal;
