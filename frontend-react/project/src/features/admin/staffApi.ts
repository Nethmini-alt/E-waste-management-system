import { api } from '../../api/client';

export type StaffType = 'Management' | 'Worker';

// Request-body enums are numbers: the backend has no JsonStringEnumConverter.
const STAFF_TYPE_VALUES: Record<StaffType, number> = { Management: 0, Worker: 1 };

export const STAFF_TYPE_LABELS: Record<StaffType, string> = {
  Management: 'Management staff',
  Worker: 'Worker staff',
};

export interface StaffMember {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  staffType: StaffType;
  isActive: boolean;
  createdAt: string;
}

export interface CreateStaffInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
  staffType: StaffType;
}

export interface StaffActivitySummary {
  userId: string;
  fullName: string;
  email: string;
  staffType: StaffType;
  isDeleted: boolean;
  itemsReceived: number;
  extraWasteReceipts: number;
  dismantleSteps: number;
  classifications: number;
  locationMoves: number;
  totalInventoryActions: number;
  paymentsRaised: number;
  paymentsPaid: number;
  amountPaid: number;
  lastActivityAt: string | null;
}

export interface StaffActivityEntry {
  performedAt: string;
  action: string;
  inventoryItemId: string;
  itemType: string | null;
  notes: string | null;
}

const BASE = '/api/v1/admin/staff';

export const staffApi = {
  list: () => api.get<StaffMember[]>(BASE).then((r) => r.data),

  create: (input: CreateStaffInput) =>
    api
      .post<StaffMember>(BASE, {
        fullName: input.fullName.trim(),
        email: input.email.trim(),
        phone: input.phone?.trim() || null,
        password: input.password,
        staffType: STAFF_TYPE_VALUES[input.staffType],
      })
      .then((r) => r.data),

  remove: (userId: string) => api.delete<void>(`${BASE}/${userId}`).then(() => undefined),

  activity: () => api.get<StaffActivitySummary[]>(`${BASE}/activity`).then((r) => r.data),

  recentActivity: (userId: string, take = 50) =>
    api.get<StaffActivityEntry[]>(`${BASE}/${userId}/activity`, { params: { take } }).then((r) => r.data),
};
