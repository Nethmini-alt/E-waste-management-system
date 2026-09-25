import { INVENTORY_STATUSES, type InventoryStatus } from '../processingEnums';
import { inventoryApi } from '../Inventory/inventoryApi';
import { paymentApi } from '../Payments/paymentApi';
import { agenticReviewApi } from '../AgenticReview/agenticReviewApi';
import type { DashboardData } from './types';

/**
 * The dashboard is assembled from the existing list endpoints — there is no dedicated summary
 * endpoint. A page of size 1 is enough to read a status' `totalCount`.
 */
export const dashboardApi = {
  load: async (): Promise<DashboardData> => {
    // A secondary figure: if the workflow API is unavailable the rest of the dashboard still loads.
    const awaitingReview = agenticReviewApi
      .list('PendingApproval')
      .then((rows) => rows.length)
      .catch(() => null);

    const [counts, recent, pending, workflowsAwaitingReview] = await Promise.all([
      Promise.all(INVENTORY_STATUSES.map((status) => inventoryApi.list({ status, page: 1, pageSize: 1 }))),
      inventoryApi.list({ sortBy: 'CreatedAt', descending: true, page: 1, pageSize: 6 }),
      paymentApi.list({ status: 'Pending', page: 1, pageSize: 5 }),
      awaitingReview,
    ]);

    const statusCounts = {} as Record<InventoryStatus, number>;
    INVENTORY_STATUSES.forEach((status, i) => {
      statusCounts[status] = counts[i].totalCount;
    });

    return {
      workflowsAwaitingReview,
      statusCounts,
      recentItems: recent.items,
      pendingPayments: { count: pending.totalCount, totalAmount: pending.totalPendingAmount, oldest: pending.items },
    };
  },
};
