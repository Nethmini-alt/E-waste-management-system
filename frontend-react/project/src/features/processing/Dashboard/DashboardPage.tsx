import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Boxes, Layers, LayoutDashboard, PackagePlus, Recycle, RefreshCw, ShoppingCart, Truck, Wallet,
} from 'lucide-react';
import { dashboardApi } from './dashboardApi';
import type { DashboardData } from './types';
import { INVENTORY_STATUSES, INVENTORY_STATUS_LABELS, ORIGIN_TYPE_LABELS, PAYMENT_SOURCE_TYPE_LABELS } from '../processingEnums';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDate, formatKg, formatMoney, shortId } from '../utils/format';
import {
  CategoryBadge,
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  Notice,
  PageHeader,
  StatusBadge,
  btnPrimary,
  btnSecondary,
} from '../components';

const StatCard: React.FC<{ label: string; value: React.ReactNode; hint?: string; icon: React.ElementType; tone?: 'default' | 'danger' }> = ({
  label, value, hint, icon: Icon, tone = 'default',
}) => (
  <GlassCard>
    <div className="flex items-start justify-between">
      <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">{label}</p>
      <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone === 'danger' ? 'bg-red-100 text-red-700' : 'bg-mint-50 text-mint-700'}`}>
        <Icon size={16} />
      </span>
    </div>
    <p className="mt-2 font-display text-2xl font-bold text-ink-900">{value}</p>
    {hint && <p className="text-xs text-ink-600">{hint}</p>}
  </GlassCard>
);

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dashboardApi.load());
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load the dashboard.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const counts = data?.statusCounts;
  const total = counts ? INVENTORY_STATUSES.reduce((sum, s) => sum + counts[s], 0) : 0;
  const inProgress = counts ? counts.Received + counts.Sorting + counts.Dismantling : 0;
  const outbound = counts ? counts.ReadyForSale + counts.ExportOnly : 0;

  return (
    <div>
      <PageHeader
        title="Processing"
        subtitle="Receive, sort, dismantle and classify e-waste, and settle collector payments."
        icon={LayoutDashboard}
        actions={
          <>
            <button type="button" onClick={load} className={btnSecondary} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <Link to="/processing/receive" className={btnPrimary}>
              <PackagePlus size={14} /> Receive waste
            </Link>
          </>
        }
      />

      {error ? (
        <ErrorMessage message={error} onRetry={load} />
      ) : loading && !data ? (
        <LoadingState label="Loading dashboard…" />
      ) : data && counts ? (
        <div className="space-y-5">
          {/* Attention */}
          {(counts.OnHold > 0 || counts.Received > 0 || (data.workflowsAwaitingReview ?? 0) > 0) && (
            <div className="grid gap-3 md:grid-cols-2">
              {(data.workflowsAwaitingReview ?? 0) > 0 && (
                <Notice tone="warning">
                  <Link to="/processing/agentic-review" className="font-semibold underline underline-offset-2">
                    {data.workflowsAwaitingReview} AI workflow{data.workflowsAwaitingReview === 1 ? '' : 's'}
                  </Link>{' '}
                  waiting for a human decision.
                </Notice>
              )}
              {counts.Received > 0 && (
                <Notice tone="info">
                  <Link to="/processing/inventory?status=Received" className="font-semibold underline underline-offset-2">
                    {counts.Received} item{counts.Received === 1 ? '' : 's'}
                  </Link>{' '}
                  received and waiting to be sorted.
                </Notice>
              )}
              {counts.OnHold > 0 && (
                <Notice tone="warning">
                  <Link to="/processing/inventory?status=OnHold" className="font-semibold underline underline-offset-2">
                    {counts.OnHold} item{counts.OnHold === 1 ? '' : 's'}
                  </Link>{' '}
                  on hold (quarantined).
                </Notice>
              )}
            </div>
          )}

          {/* KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Total items" value={total} hint="Everything received" icon={Boxes} />
            <StatCard label="In progress" value={inProgress} hint="Received, sorting or dismantling" icon={Layers} />
            <StatCard label="Ready to hand off" value={outbound} hint="Ready for sale or reserved for export" icon={ShoppingCart} />
            <StatCard
              label="Pending payments"
              value={formatMoney(data.pendingPayments.totalAmount)}
              hint={`${data.pendingPayments.count} payment${data.pendingPayments.count === 1 ? '' : 's'} to settle`}
              icon={Wallet}
            />
          </div>

          {/* Pipeline */}
          <GlassCard>
            <h3 className="mb-3 font-display text-base font-bold text-ink-900">Inventory by status</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-7">
              {INVENTORY_STATUSES.map((status) => (
                <Link
                  key={status}
                  to={`/processing/inventory?status=${status}`}
                  className="rounded-2xl border border-mint-100 bg-white/60 p-3.5 transition hover:-translate-y-0.5 hover:bg-mint-50/70 hover:shadow-md"
                >
                  <StatusBadge status={status} />
                  <p className="mt-2 font-display text-2xl font-bold text-ink-900">{counts[status]}</p>
                  <p className="text-[11px] text-ink-600">{INVENTORY_STATUS_LABELS[status]}</p>
                </Link>
              ))}
            </div>
          </GlassCard>

          <div className="grid gap-5 lg:grid-cols-5">
            {/* Recent items */}
            <GlassCard padded={false} className="lg:col-span-3">
              <div className="flex items-center justify-between px-5 pb-2 pt-5">
                <h3 className="font-display text-base font-bold text-ink-900">Recently received</h3>
                <Link to="/processing/inventory" className="inline-flex items-center gap-1 text-xs font-semibold text-mint-700 hover:underline">
                  All inventory <ArrowRight size={12} />
                </Link>
              </div>
              {data.recentItems.length === 0 ? (
                <EmptyState icon={Boxes} title="No inventory yet" description="Receive a job or an extra-waste drop-off to get started." />
              ) : (
                <ul className="divide-y divide-mint-50 pb-2">
                  {data.recentItems.map((item) => (
                    <li key={item.id}>
                      <Link to={`/processing/inventory/${item.id}`} className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-mint-50/70">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900">{item.itemType}</p>
                          <p className="text-xs text-ink-600">
                            {ORIGIN_TYPE_LABELS[item.originType]} · {formatKg(item.verifiedWeightKg)} · {item.currentLocationName} · {formatDate(item.receivedAt)}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 items-center gap-2">
                          <CategoryBadge category={item.category} />
                          <StatusBadge status={item.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>

            {/* Payments waiting */}
            <GlassCard padded={false} className="lg:col-span-2">
              <div className="flex items-center justify-between px-5 pb-2 pt-5">
                <h3 className="font-display text-base font-bold text-ink-900">Longest-waiting payments</h3>
                <Link to="/processing/payments" className="inline-flex items-center gap-1 text-xs font-semibold text-mint-700 hover:underline">
                  All payments <ArrowRight size={12} />
                </Link>
              </div>
              {data.pendingPayments.oldest.length === 0 ? (
                <EmptyState icon={Wallet} title="All settled" description="There are no pending collector payments." />
              ) : (
                <ul className="divide-y divide-mint-50 pb-2">
                  {data.pendingPayments.oldest.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">{p.collectorName ?? `Collector ${shortId(p.collectorId)}`}</p>
                        <p className="text-xs text-ink-600">
                          {PAYMENT_SOURCE_TYPE_LABELS[p.sourceType]} · {formatDate(p.createdAt)}
                        </p>
                      </div>
                      <span className="flex-shrink-0 font-mono text-sm font-semibold text-ink-900">{formatMoney(p.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </GlassCard>
          </div>

          {/* Shortcuts */}
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { to: '/processing/receive', icon: Truck, title: 'Receive a job', desc: 'Weigh in a completed pickup job' },
              { to: '/processing/receive?tab=extra', icon: Recycle, title: 'Extra-waste drop-off', desc: 'Record a walk-in delivery' },
              { to: '/processing/inventory', icon: Boxes, title: 'Inventory', desc: 'Search, sort and classify items' },
              { to: '/processing/payments', icon: Wallet, title: 'Payments', desc: 'Pending payments and history' },
            ].map(({ to, icon: Icon, title, desc }) => (
              <Link key={to} to={to}>
                <GlassCard interactive className="h-full">
                  <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 text-white shadow-md shadow-mint-500/30">
                    <Icon size={18} />
                  </span>
                  <p className="text-sm font-semibold text-ink-900">{title}</p>
                  <p className="text-xs text-ink-600">{desc}</p>
                </GlassCard>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default DashboardPage;
