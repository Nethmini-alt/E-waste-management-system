import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarRange, Download, Search, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { submissionApi } from './submissionApi';
import type { SubmissionResponse } from './types';

const getAi = (submission: SubmissionResponse) => submission.aiAnalysis ?? submission.aIAnalysis ?? submission.AiAnalysis;

const SubmissionHistoryPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await submissionApi.list();
        setSubmissions(data);
      } catch (error) {
        console.error('Failed to load submission history', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const filteredSubmissions = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return submissions;

    return submissions.filter((item) => {
      const firstItem = item.items?.[0];
      const itemName = (firstItem?.itemName ?? '').toLowerCase();
      const itemId = item.id.toLowerCase();
      const category = (item.category ?? '').toLowerCase();
      return itemId.includes(query) || itemName.includes(query) || category.includes(query);
    });
  }, [searchTerm, submissions]);

  const handleExport = () => {
    const rows = filteredSubmissions.length ? filteredSubmissions : submissions;
    const header = ['ID', 'Status', 'Item', 'Category', 'Weight', 'Created At'];
    const csv = [
      header.join(','),
      ...rows.map((item) => {
        const firstItem = item.items?.[0];
        const ai = getAi(item);
        return [
          item.id,
          item.status,
          (firstItem?.itemName ?? '').replace(/,/g, ' '),
          (ai?.wasteCategory ?? item.category ?? '').replace(/,/g, ' '),
          String(item.estimatedWeight ?? ai?.estimatedVolumeKg ?? ''),
          item.createdAt ?? '',
        ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',');
      }),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = 'submission-history.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/submissions" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-slate-700 ring-1 ring-slate-200 transition hover:bg-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">History</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Submission history</h1>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
        >
          <Download size={16} /> Export
        </button>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600 md:w-[420px]">
            <Search size={16} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by ID or item type"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <CalendarRange size={16} /> Last 30 days
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur-sm">
        {loading ? (
          <p className="p-3 text-sm text-slate-500">Loading submissions…</p>
        ) : (
          <div className="space-y-3">
            {filteredSubmissions.length === 0 ? (
              <p className="p-3 text-sm text-slate-500">No submissions match your filter.</p>
            ) : (
              filteredSubmissions.map((item) => {
                const ai = getAi(item);
                const firstItem = item.items?.[0];

                return (
                  <div key={item.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{item.id.slice(0, 8).toUpperCase()}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                          item.status === 'Approved'
                            ? 'bg-emerald-100 text-emerald-700'
                            : item.status === 'Completed'
                              ? 'bg-sky-100 text-sky-700'
                              : item.status?.toLowerCase().includes('review') || item.status === 'Pending_Approval'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-slate-200 text-slate-700'
                        }`}>{item.status}</span>
                      </div>
                      <p className="mt-1 text-base font-semibold text-slate-800">{firstItem?.itemName || 'E-waste item'}</p>
                      <p className="mt-1 text-sm text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}</p>
                    </div>

                    <div className="flex items-center gap-8">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Impact</p>
                        <p className="mt-1 text-sm font-semibold text-slate-800">{ai?.estimatedVolumeKg ? `${Number(ai.estimatedVolumeKg).toFixed(1)} kg` : 'Pending assessment'}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Hazard level</p>
                        <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-slate-800">
                          <ShieldCheck size={14} className="text-emerald-600" /> {ai?.hazardLevel || 'Pending'}
                        </p>
                      </div>
                      <Link to={`/submissions/report/${item.id}`} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">View report</Link>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SubmissionHistoryPage;
