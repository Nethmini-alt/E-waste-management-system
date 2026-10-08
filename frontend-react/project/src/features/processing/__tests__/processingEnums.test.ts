// TC-C-R03 / R07 / R09 / R11 — enum numbers sent to the API, and the status workflow the UI offers.
import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  CLASSIFICATION_CATEGORY_VALUES,
  INVENTORY_STATUSES,
  INVENTORY_STATUS_VALUES,
  ITEM_KIND_VALUES,
  OUTCOME_FOR_CATEGORY,
  canAddDismantleStep,
  canClassify,
  getManualTransitions,
  isInventoryStatus,
  isReservedExtraWasteType,
  isTerminalStatus,
} from '../processingEnums';

describe('TC-C-R03 enum numbers match the backend (Enums.cs declaration order)', () => {
  it('InventoryStatus', () => {
    expect(INVENTORY_STATUS_VALUES).toEqual({
      Received: 0, Sorting: 1, Dismantling: 2, Classified: 3, ReadyForSale: 4, ExportOnly: 5, OnHold: 6, Recovered: 7,
    });
  });

  it('ItemKind and ClassificationCategory', () => {
    expect(ITEM_KIND_VALUES).toEqual({ Unit: 0, Component: 1, Material: 2 });
    expect(CLASSIFICATION_CATEGORY_VALUES).toEqual({ Reusable: 0, LocalRecyclable: 1, Hazardous: 2, ExportOnly: 3 });
  });

  it('rejects unknown status names from the URL', () => {
    expect(isInventoryStatus('Sorting')).toBe(true);
    expect(isInventoryStatus('sorting')).toBe(false);
    expect(isInventoryStatus('Sold')).toBe(false);
    expect(isInventoryStatus(4)).toBe(false);
  });
});

describe('TC-C-R09 status actions offered for each status (mirror of the backend rules)', () => {
  it('a received item can only go to Sorting', () => {
    expect(getManualTransitions('Received')).toEqual(['Sorting']);
  });

  it('never offers Dismantling or Classified as plain status changes (they have their own actions)', () => {
    for (const status of INVENTORY_STATUSES) {
      const offered = getManualTransitions(status, 'Reusable');
      expect(offered).not.toContain('Dismantling');
      expect(offered).not.toContain('Classified');
    }
  });

  it('final statuses offer no actions', () => {
    for (const status of ['ReadyForSale', 'ExportOnly', 'OnHold'] as const) {
      expect(isTerminalStatus(status)).toBe(true);
      expect(getManualTransitions(status)).toEqual([]);
    }
    expect(isTerminalStatus('Sorting')).toBe(false);
  });

  it('dismantle steps and classification are only possible while sorting or dismantling', () => {
    for (const status of INVENTORY_STATUSES) {
      const expected = status === 'Sorting' || status === 'Dismantling';
      expect(canAddDismantleStep(status)).toBe(expected);
      expect(canClassify(status)).toBe(expected);
    }
  });

  it('every target in the transition table is itself a known status', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const t of targets) expect(INVENTORY_STATUSES).toContain(t);
    }
  });
});

describe('TC-C-R11 classification decides the outcome', () => {
  it.each([
    ['Reusable', ['ReadyForSale', 'OnHold']],
    ['LocalRecyclable', ['ReadyForSale', 'OnHold']],
    ['ExportOnly', ['ExportOnly', 'OnHold']],
    ['Hazardous', ['OnHold']],
  ] as const)('a classified %s item can go to %j', (category, expected) => {
    expect(getManualTransitions('Classified', category)).toEqual(expected);
  });

  it('a classified item with no or an unknown category can only be put on hold', () => {
    expect(getManualTransitions('Classified', null)).toEqual(['OnHold']);
    expect(getManualTransitions('Classified', 'Gold')).toEqual(['OnHold']);
  });

  it('hazardous items have no sale outcome of their own', () => {
    expect(OUTCOME_FOR_CATEGORY.Hazardous).toBeNull();
  });
});

describe('TC-C-R07 reserved extra-waste type', () => {
  it('"GeneralCollection" is not a real item type, in any case or spacing', () => {
    expect(isReservedExtraWasteType('GeneralCollection')).toBe(true);
    expect(isReservedExtraWasteType('  generalcollection ')).toBe(true);
    expect(isReservedExtraWasteType('Laptop')).toBe(false);
  });
});
