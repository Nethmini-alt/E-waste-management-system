import { api } from '../../../api/client';
import type { DeliverySummary, PaymentDetail, PaymentListQuery, PaymentListResponse, PaymentResponse } from './types';

export const paymentApi = {
  /** Pending and paid payments with collector info. Enum filters are sent by name (query string). */
  list: (q: PaymentListQuery) => api.get<PaymentListResponse>('/api/v1/payments', { params: q }).then((r) => r.data),

  /** One payment with its saved calculation snapshot and audit trail. */
  get: (id: string) => api.get<PaymentDetail>(`/api/v1/payments/${id}`).then((r) => r.data),

  /** The staff member who pays is taken from the JWT on the server — nothing about them is sent. */
  markPaid: (id: string) => api.put<PaymentResponse>(`/api/v1/payments/${id}/pay`).then((r) => r.data),

  getDelivery: (deliveryId: string) =>
    api.get<DeliverySummary>(`/api/v1/payments/deliveries/${deliveryId}`).then((r) => r.data),

  /** Pays every still-pending job payment of the delivery at once. */
  payDelivery: (deliveryId: string) =>
    api.put<DeliverySummary>(`/api/v1/payments/deliveries/${deliveryId}/pay`).then((r) => r.data),
};
