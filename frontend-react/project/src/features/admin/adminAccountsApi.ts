import { api } from '../../api/client';

export interface AdminAccount {
  userId: string;
  fullName: string;
  email: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

/** On update, an empty password keeps the current one. */
export interface AdminAccountInput {
  fullName: string;
  email: string;
  phone?: string;
  password: string;
}

const BASE = '/api/v1/admin/admins';

const toBody = (input: AdminAccountInput) => ({
  fullName: input.fullName.trim(),
  email: input.email.trim(),
  phone: input.phone?.trim() || null,
  password: input.password || null,
});

export const adminAccountsApi = {
  list: () => api.get<AdminAccount[]>(BASE).then((r) => r.data),

  create: (input: AdminAccountInput) => api.post<AdminAccount>(BASE, toBody(input)).then((r) => r.data),

  update: (userId: string, input: AdminAccountInput) =>
    api.put<AdminAccount>(`${BASE}/${userId}`, toBody(input)).then((r) => r.data),

  remove: (userId: string) => api.delete<void>(`${BASE}/${userId}`).then(() => undefined),
};
