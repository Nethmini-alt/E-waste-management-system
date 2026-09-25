/**
 * Central mapping for the backend's Processing enums.
 *
 * The API returns enums as strings ("Sorting") but the backend does NOT register a
 * JsonStringEnumConverter, so enums inside REQUEST BODIES must be sent as numbers.
 * The numeric values below mirror the C# declaration order in
 * backend/.../Features/Processing/Entities/Enums.cs — append-only, never reorder.
 * Nothing outside this file should contain a raw enum number.
 */

// ---------------------------------------------------------------- enum value maps

export const INVENTORY_STATUS_VALUES = {
  Received: 0,
  Sorting: 1,
  Dismantling: 2,
  Classified: 3,
  ReadyForSale: 4,
  ExportOnly: 5,
  OnHold: 6,
} as const;

export const CLASSIFICATION_CATEGORY_VALUES = {
  Reusable: 0,
  LocalRecyclable: 1,
  Hazardous: 2,
  ExportOnly: 3,
} as const;

export const CLASSIFICATION_SOURCE_VALUES = {
  Manual: 0,
  Ai: 1,
} as const;

export const ORIGIN_TYPE_VALUES = {
  JobCollection: 0,
  ExtraWaste: 1,
} as const;

export const PAYMENT_SOURCE_TYPE_VALUES = {
  Job: 0,
  ExtraWaste: 1,
} as const;

export const PAYMENT_STATUS_VALUES = {
  Pending: 0,
  Paid: 1,
} as const;

// ---------------------------------------------------------------- string-name types

export type InventoryStatus = keyof typeof INVENTORY_STATUS_VALUES;
export type ClassificationCategory = keyof typeof CLASSIFICATION_CATEGORY_VALUES;
export type ClassificationSource = keyof typeof CLASSIFICATION_SOURCE_VALUES;
export type OriginType = keyof typeof ORIGIN_TYPE_VALUES;
export type PaymentSourceType = keyof typeof PAYMENT_SOURCE_TYPE_VALUES;
export type PaymentStatus = keyof typeof PAYMENT_STATUS_VALUES;

export const INVENTORY_STATUSES = Object.keys(INVENTORY_STATUS_VALUES) as InventoryStatus[];
export const CLASSIFICATION_CATEGORIES = Object.keys(CLASSIFICATION_CATEGORY_VALUES) as ClassificationCategory[];
export const CLASSIFICATION_SOURCES = Object.keys(CLASSIFICATION_SOURCE_VALUES) as ClassificationSource[];
export const ORIGIN_TYPES = Object.keys(ORIGIN_TYPE_VALUES) as OriginType[];
export const PAYMENT_SOURCE_TYPES = Object.keys(PAYMENT_SOURCE_TYPE_VALUES) as PaymentSourceType[];
export const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_VALUES) as PaymentStatus[];

// ---------------------------------------------------------------- name -> number (request bodies)

export const inventoryStatusValue = (s: InventoryStatus): number => INVENTORY_STATUS_VALUES[s];
export const classificationCategoryValue = (c: ClassificationCategory): number => CLASSIFICATION_CATEGORY_VALUES[c];
export const classificationSourceValue = (s: ClassificationSource): number => CLASSIFICATION_SOURCE_VALUES[s];

// ---------------------------------------------------------------- type guards (URL params etc.)

const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === 'string' && (list as readonly string[]).includes(value);

export const isInventoryStatus = (v: unknown): v is InventoryStatus => isOneOf(INVENTORY_STATUSES, v);
export const isClassificationCategory = (v: unknown): v is ClassificationCategory => isOneOf(CLASSIFICATION_CATEGORIES, v);
export const isOriginType = (v: unknown): v is OriginType => isOneOf(ORIGIN_TYPES, v);
export const isPaymentSourceType = (v: unknown): v is PaymentSourceType => isOneOf(PAYMENT_SOURCE_TYPES, v);
export const isPaymentStatus = (v: unknown): v is PaymentStatus => isOneOf(PAYMENT_STATUSES, v);

// ---------------------------------------------------------------- display labels

export const INVENTORY_STATUS_LABELS: Record<InventoryStatus, string> = {
  Received: 'Received',
  Sorting: 'Sorting',
  Dismantling: 'Dismantling',
  Classified: 'Classified',
  ReadyForSale: 'Ready for sale',
  ExportOnly: 'Export only',
  OnHold: 'On hold',
};

export const CLASSIFICATION_CATEGORY_LABELS: Record<ClassificationCategory, string> = {
  Reusable: 'Reusable',
  LocalRecyclable: 'Local recyclable',
  Hazardous: 'Hazardous',
  ExportOnly: 'Export only',
};

export const CLASSIFICATION_SOURCE_LABELS: Record<ClassificationSource, string> = {
  Manual: 'Manual',
  Ai: 'AI-assisted',
};

export const ORIGIN_TYPE_LABELS: Record<OriginType, string> = {
  JobCollection: 'Job collection',
  ExtraWaste: 'Extra waste',
};

export const PAYMENT_SOURCE_TYPE_LABELS: Record<PaymentSourceType, string> = {
  Job: 'Job collection',
  ExtraWaste: 'Extra waste',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  Pending: 'Pending',
  Paid: 'Paid',
};

// ---------------------------------------------------------------- status workflow

/**
 * Mirror of InventoryItem.AllowedTransitions on the backend. The server stays the source of
 * truth (it answers 409 on an illegal jump); this copy only lets the UI hide actions that
 * could never succeed.
 */
export const ALLOWED_TRANSITIONS: Record<InventoryStatus, readonly InventoryStatus[]> = {
  Received: ['Sorting'],
  Sorting: ['Dismantling', 'Classified'],
  Dismantling: ['Classified'],
  Classified: ['ReadyForSale', 'ExportOnly', 'OnHold'],
  ReadyForSale: [],
  ExportOnly: [],
  OnHold: [],
};

export const isTerminalStatus = (s: InventoryStatus): boolean => ALLOWED_TRANSITIONS[s].length === 0;

/** Dismantle steps are only accepted while an item is being sorted or dismantled. */
export const canAddDismantleStep = (s: InventoryStatus): boolean => s === 'Sorting' || s === 'Dismantling';

/** Classification is only accepted from Sorting/Dismantling, and is the only way to reach Classified. */
export const canClassify = (s: InventoryStatus): boolean => s === 'Sorting' || s === 'Dismantling';

/**
 * Transitions the plain status endpoint may perform. Classified is reachable only through
 * PUT /classify (the backend rejects it here), and Dismantling is entered by logging the first
 * dismantle step, so both are excluded.
 */
export const getManualTransitions = (s: InventoryStatus): InventoryStatus[] =>
  ALLOWED_TRANSITIONS[s].filter((next) => next !== 'Classified' && next !== 'Dismantling');

/**
 * "GeneralCollection" is the rate-policy key that prices the weight part of a JOB-collection
 * payment. It is not a real item type, so it is hidden from extra-waste item selection (the backend
 * rejects it too). It still appears on the read-only Rate Policies page.
 */
export const JOB_PAYMENT_RATE_KEY = 'GeneralCollection';

export const isReservedExtraWasteType = (itemType: string): boolean =>
  itemType.trim().toLowerCase() === JOB_PAYMENT_RATE_KEY.toLowerCase();

/** Backend limits, kept next to the enums so forms and validators agree with the API. */
export const LIMITS = {
  notes: 1000,
  subCategory: 100,
  childItemType: 50,
  itemType: 50,
  rejectionReason: 500,
  idempotencyKey: 100,
  search: 100,
  pageSize: 20,
  maxPageSize: 100,
} as const;

/** ClassificationValidationService flags anything below this for human review. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;
