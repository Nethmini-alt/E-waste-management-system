import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight, MapPin, PackageOpen, RefreshCw, Search, ShoppingCart } from 'lucide-react';
import { inventoryApi } from '../Inventory/inventoryApi';
import type { RecoveredMaterialGroup } from '../Inventory/types';
import { getApiErrorMessage } from '../utils/apiError';
import { formatDateTime, formatKg } from '../utils/format';
import {
  EmptyState,
  ErrorMessage,
  GlassCard,
  LoadingState,
  PageHeader,
  btnPrimary,
  btnSecondary,
  inputClass,
  tableCellClass,
  tableHeadClass,
} from '../components';

/**
 * Recovered materials that are ready for sale, one row per material with the total weight across every
 * item (e.g. Aluminium 1 kg + 0.4 kg = 1.4 kg). Open a row to see each item and where it is stored.
 */
const MaterialStockPage: React.FC = () => {
  const [groups, setGroups] = useState<RecoveredMaterialGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setGroups(await inventoryApi.recoveredMaterials());
    } catch (e) {
      setError(getApiErrorMessage(e, 'Failed to load recovered materials.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggle = (materialType: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(materialType)) next.delete(materialType);
      else next.add(materialType);
      return next;
    });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? groups.filter((g) => g.materialType.toLowerCase().includes(q)) : groups;
  }, [groups, search]);

  const totalKg = groups.reduce((sum, g) => sum + g.totalWeightKg, 0);
  const availableKg = groups.reduce((sum, g) => sum + g.availableWeightKg, 0);

  return (
    <div>
      <PageHeader
        title="Material stock"
        subtitle="Recovered materials from dismantling that are ready for sale, totalled per material. Open a material to see each item and its warehouse location."
        icon={PackageOpen}
        actions={
          <>
            <button type="button" onClick={load} className={btnSecondary} disabled={loading}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
            <Link to="/sales-orders?new=1" className={btnPrimary}>
              <ShoppingCart size={14} /> New sales order
            </Link>
          </>
        }
      />

      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <GlassCard>
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Materials</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink-900">{groups.length}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Total in stock</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink-900">{formatKg(totalKg)}</p>
        </GlassCard>
        <GlassCard>
          <p className="text-[11px] font-mono uppercase tracking-wide text-ink-600">Available to sell</p>
          <p className="mt-2 font-display text-2xl font-bold text-ink-900">{formatKg(availableKg)}</p>
          <p className="text-xs text-ink-600">Not yet reserved on sales or export orders</p>
        </GlassCard>
      </div>

      <GlassCard className="mb-4">
        <div className="relative max-w-md">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search material…"
            aria-label="Search material"
            className={`${inputClass} pl-10`}
          />
        </div>
      </GlassCard>

      <GlassCard padded={false}>
        {error ? (
          <div className="p-5">
            <ErrorMessage message={error} onRetry={load} />
          </div>
        ) : loading && groups.length === 0 ? (
          <LoadingState label="Loading materials…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title={groups.length === 0 ? 'No recovered materials yet' : 'No material matches your search'}
            description={
              groups.length === 0
                ? 'Materials appear here when they are recorded in a dismantle step and are ready for sale.'
                : 'Try a different name.'
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Material</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Items</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Total weight</th>
                  <th className={`${tableHeadClass} px-4 py-3 text-right`}>Available</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((g) => {
                  const isOpen = open.has(g.materialType);
                  return (
                    <React.Fragment key={g.materialType}>
                      <tr
                        onClick={() => toggle(g.materialType)}
                        className="cursor-pointer border-b border-mint-50 transition-colors hover:bg-mint-50/70"
                        aria-expanded={isOpen}
                      >
                        <td className={`${tableCellClass} font-semibold text-ink-900`}>
                          <span className="inline-flex items-center gap-1.5">
                            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />} {g.materialType}
                          </span>
                        </td>
                        <td className={`${tableCellClass} text-right font-mono`}>{g.itemCount}</td>
                        <td className={`${tableCellClass} text-right font-mono font-semibold text-ink-900`}>{formatKg(g.totalWeightKg)}</td>
                        <td className={`${tableCellClass} text-right font-mono`}>{formatKg(g.availableWeightKg)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="border-b border-mint-100 bg-white/50">
                          <td colSpan={4} className="px-4 pb-4 pt-1">
                            <table className="w-full border-collapse">
                              <thead>
                                <tr className="border-b border-mint-100">
                                  <th className={`${tableHeadClass} px-3 py-2`}>Item</th>
                                  <th className={`${tableHeadClass} px-3 py-2`}>Warehouse location</th>
                                  <th className={`${tableHeadClass} px-3 py-2`}>From</th>
                                  <th className={`${tableHeadClass} px-3 py-2`}>Recorded</th>
                                  <th className={`${tableHeadClass} px-3 py-2 text-right`}>Weight</th>
                                  <th className={`${tableHeadClass} px-3 py-2 text-right`}>Available</th>
                                </tr>
                              </thead>
                              <tbody>
                                {g.items.map((i) => (
                                  <tr key={i.inventoryItemId} className="border-b border-mint-50 last:border-0">
                                    <td className="px-3 py-2 text-sm">
                                      <Link to={`/processing/inventory/${i.inventoryItemId}`} className="font-semibold text-mint-700 hover:underline">
                                        Open item
                                      </Link>
                                    </td>
                                    <td className="px-3 py-2 text-sm text-ink-900">
                                      <span className="inline-flex items-center gap-1">
                                        <MapPin size={13} className="text-mint-600" /> {i.locationName}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-sm">
                                      {i.parentInventoryItemId ? (
                                        <Link to={`/processing/inventory/${i.parentInventoryItemId}`} className="text-ink-800 hover:text-mint-700 hover:underline">
                                          {i.parentItemType ?? 'Parent item'}
                                        </Link>
                                      ) : (
                                        '—'
                                      )}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-2 text-sm text-ink-800">{formatDateTime(i.recordedAt)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-sm">{formatKg(i.weightKg)}</td>
                                    <td className="px-3 py-2 text-right font-mono text-sm">{formatKg(i.availableWeightKg)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
};

export default MaterialStockPage;
