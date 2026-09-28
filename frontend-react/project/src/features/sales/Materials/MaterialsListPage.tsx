/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useMemo, useState } from 'react';
import { Package, Search, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { materialApi } from './materialApi';
import type { RecoveredMaterial } from './types';
import {
  EmptyState, ErrorMessage, GlassCard, PageHeader,
  btnSecondary, inputClass, tableCellClass, tableHeadClass,
} from '../../../components/ui';

const MaterialsListPage: React.FC = () => {
  const [rows, setRows] = useState<RecoveredMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(
        onlyAvailable
          ? await materialApi.listAvailable()
          : await materialApi.listAll()
      );
    } catch (e: any) {
      setError(e?.response?.data?.title ?? 'Failed to load materials.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [onlyAvailable]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return rows.filter(
      (m) =>
        m.materialType.toLowerCase().includes(q) ||
        m.qualityGrade.toLowerCase().includes(q)
    );
  }, [rows, search]);

  return (
    <div>
      <PageHeader
        title="Recovered materials"
        subtitle="Read-only view. Source: Processing. These batches are inputs to pricing, sales, and export."
        icon={Package}
        actions={<button onClick={load} className={btnSecondary}><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>}
      />

      <GlassCard hover={false} className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-600" />
            <input
              placeholder="Search material or grade…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${inputClass} pl-10`}
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-800">
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} className="accent-mint-600" />
            Only sellable
          </label>
        </div>
      </GlassCard>

      {error && <ErrorMessage message={error} onRetry={load} className="mb-4" />}

      <GlassCard hover={false} padded={false}>
        {loading && !rows.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-600">Loading materials…</p>
        ) : !error && filtered.length === 0 ? (
          <EmptyState icon={Package} title="No materials match your filters" />
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-mint-100">
                  <th className={`${tableHeadClass} px-4 py-3`}>Material</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Quantity (kg)</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Grade</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Processing</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Safety</th>
                  <th className={`${tableHeadClass} px-4 py-3`}>Available</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.recoveredMaterialId} className="border-b border-mint-50 last:border-0">
                    <td className={`${tableCellClass} font-semibold text-ink-900`}>{m.materialType}</td>
                    <td className={tableCellClass}>{m.quantityKg.toFixed(2)}</td>
                    <td className={tableCellClass}>{m.qualityGrade}</td>
                    <td className={tableCellClass}><ProcessingPill status={m.processingStatus} /></td>
                    <td className={tableCellClass}>
                      {m.safetyValidated ? (
                        <span className="flex items-center gap-1.5 text-mint-700"><CheckCircle2 size={14} /> Validated</span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-600"><AlertTriangle size={14} /> Not validated</span>
                      )}
                    </td>
                    <td className={`${tableCellClass} text-ink-600`}>{new Date(m.availableAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </GlassCard>
    </div>
  );
};

const ProcessingPill: React.FC<{ status: string }> = ({ status }) => {
  const cls = status === 'Ready' ? 'bg-mint-100 text-mint-800' : status === 'Rejected' ? 'bg-red-100 text-red-700' : status === 'InProgress' ? 'bg-amber-100 text-amber-800' : 'bg-ink-100 text-ink-700';
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}>{status}</span>;
};

export default MaterialsListPage;
