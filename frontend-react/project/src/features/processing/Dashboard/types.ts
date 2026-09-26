import type { InventoryStatus } from '../processingEnums';
import type { InventoryListItem } from '../Inventory/types';
import type { PaymentListItem } from '../Payments/types';

export interface DashboardData {
  /** Workflows waiting for a human decision; null if that count could not be loaded (never blocks the dashboard). */
  workflowsAwaitingReview: number | null;
  /** Number of inventory items in each status. */
  statusCounts: Record<InventoryStatus, number>;
  recentItems: InventoryListItem[];
  pendingPayments: {
    count: number;
    totalAmount: number;
    /** The payments that have waited longest. */
    oldest: PaymentListItem[];
  };
}
