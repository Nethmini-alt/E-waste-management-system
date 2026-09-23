export interface RevenueTransaction {
  revenueId: string;
  transactionType: 'LocalSale' | 'Export';
  referenceId: string;
  amount: number;
  transactionDate: string;
  remarks?: string | null;
  recordedByUserId: string;
  recordedByName: string;
}

export interface MonthlyRevenue {
  month: string;   // "2026-01"
  amount: number;
  count: number;
}

export interface RevenueSummary {
  totalRevenue: number;
  localSaleRevenue: number;
  exportRevenue: number;
  transactionCount: number;
  monthly: MonthlyRevenue[];
}