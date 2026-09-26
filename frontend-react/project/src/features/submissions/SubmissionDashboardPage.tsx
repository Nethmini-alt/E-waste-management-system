import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Bot, CheckCircle2, Clock3, Gauge, History, Leaf, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { submissionApi } from './submissionApi';
import type { SubmissionResponse } from './types';

const getAi = (submission: SubmissionResponse) =>
  submission.aiAnalysis ?? submission.aIAnalysis ?? submission.AiAnalysis;

const toneClasses: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
  green: 'bg-lime-50 text-lime-700 ring-lime-100',
};

const SubmissionDashboardPage: React.FC = () => {
  const [submissions, setSubmissions] = useState<SubmissionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await submissionApi.list();
        setSubmissions(data);
      } catch (error) {
        console.error('Failed to load submissions dashboard', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const summary = useMemo(() => {
    const approved = submissions.filter((item) => item.status === 'Approved').length;
    const pending = submissions.filter((item) => item.status?.includes('Pending') || item.status === 'Pending_Approval').length;
    const total = submissions.length;
    const impactKg = submissions.reduce((sum, item) => {
      const ai = getAi(item);
      const volume = ai?.estimatedVolumeKg ?? 0;
      return sum + Number(volume || 0);
    }, 0);

    return {
      total,
      approved,
      pending,
      impactKg,
      analyzedPct: submissions.length
        ? Math.round(
            (submissions.reduce((sum, item) => sum + (getAi(item) ? 1 : 0), 0) /
              submissions.length) *
              100
          )
        : 0,
      approvedPct: submissions.length ? Math.round((approved / submissions.length) * 100) : 0,
      pendingPct: submissions.length ? Math.round((pending / submissions.length) * 100) : 0,
      highHazardCount: submissions.filter((item) => {
        const hazard = getAi(item)?.hazardLevel;
        return hazard === 'High' || hazard === 'Critical';
      }).length,
    };
  }, [submissions]);

  const quickActions = [
    { title: 'Individual submission', description: 'Register a single e-waste item with AI screening.', path: '/submissions/individual', icon: CheckCircle2 },
    { title: 'Cooperative submission', description: 'Submit bulk waste from a household or community team.', path: '/submissions/cooperative', icon: Users },
    { title: 'AI assessment', description: 'Review dynamic safety questions and confidence score.', path: `/submissions/assessment/${submissions[0]?.id ?? 'new'}`, icon: Bot },
    { title: 'Submission history', description: 'Track all intake records, decisions, and outcomes.', path: '/submissions/history', icon: History },
  ];

  const recentItems = submissions.slice(0, 4).map((submission) => {
    const item = submission.items?.[0];
    const ai = getAi(submission);
    return {
      id: submission.id?.slice(0, 8).toUpperCase() ?? 'SUB',
      type: item?.itemName || 'E-waste item',
      status: submission.status || 'Pending_AI_Analysis',
      impact: ai?.estimatedVolumeKg ? `${Number(ai.estimatedVolumeKg).toFixed(1)} kg` : 'Awaiting assessment',
      date: submission.createdAt ? new Date(submission.createdAt).toLocaleDateString() : 'Recently',
    };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Submission module</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Operational submission dashboard</h1>
        </div>
        <Link
          to="/submissions/individual"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700"
        >
          New intake <ArrowRight size={16} />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Total submissions', value: String(summary.total), tone: 'emerald', icon: TrendingUp },
          { label: 'AI approved', value: String(summary.approved), tone: 'sky', icon: ShieldCheck },
          { label: 'Awaiting review', value: String(summary.pending), tone: 'amber', icon: Clock3 },
          { label: 'Recovered impact', value: `${summary.impactKg.toFixed(1)} kg`, tone: 'green', icon: Leaf },
        ].map(({ label, value, tone, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white/70 p-5 shadow-sm backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div className={`rounded-xl p-2 ring-1 ${toneClasses[tone]}`}>
                <Icon size={18} />
              </div>
            </div>
            <div className="mt-5">
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="mt-1 text-sm text-slate-600">{label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Quick actions</h2>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              <Gauge size={14} /> Live workflow
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {quickActions.map(({ title, description, path, icon: Icon }) => (
              <Link
                key={title}
                to={path}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4 transition hover:border-emerald-200 hover:bg-emerald-50/60"
              >
                <div className="flex items-center justify-between">
                  <div className="rounded-xl bg-white p-2 text-emerald-700 shadow-sm ring-1 ring-slate-200">
                    <Icon size={18} />
                  </div>
                  <ArrowRight size={16} className="text-slate-400 transition group-hover:text-emerald-700" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-slate-900">{title}</h3>
                <p className="mt-1 text-sm text-slate-600">{description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white shadow-lg shadow-emerald-500/15">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">Today overview</p>
          <h2 className="mt-3 text-3xl font-bold">{summary.analyzedPct}%</h2>
          <p className="mt-2 text-emerald-50/90">Submissions with completed AI analysis.</p>

          <div className="mt-6 space-y-4">
            <div>
              <div className="flex justify-between text-sm text-emerald-50/90">
                <span>Approved</span>
                <span>{summary.approvedPct}%</span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-white/20">
                <div className="h-2.5 rounded-full bg-white" style={{ width: `${summary.approvedPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm text-emerald-50/90">
                <span>Awaiting review</span>
                <span>{summary.pendingPct}%</span>
              </div>
              <div className="mt-2 h-2.5 rounded-full bg-white/20">
                <div className="h-2.5 rounded-full bg-amber-300" style={{ width: `${summary.pendingPct}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-900">Recent submissions</h2>
            <Link to="/submissions/history" className="text-sm font-semibold text-emerald-700">View all</Link>
          </div>

          {loading ? (
            <p className="mt-5 text-sm text-slate-500">Loading submissions…</p>
          ) : (
            <div className="mt-5 space-y-3">
              {recentItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{item.id}</span>
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">{item.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-800">{item.impact}</p>
                    <p className="mt-1 text-xs text-slate-500">{item.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm">
          <h2 className="text-xl font-bold text-slate-900">Priority alerts</h2>
          <div className="mt-5 space-y-3">
            {summary.highHazardCount > 0 && (
              <div className="flex gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
                <div className="mt-0.5 rounded-full bg-amber-200 p-1 text-amber-900">
                  <ShieldCheck size={12} />
                </div>
                <p className="text-sm text-slate-700">
                  {summary.highHazardCount} submission{summary.highHazardCount === 1 ? '' : 's'} flagged High/Critical hazard and need manual review.
                </p>
              </div>
            )}
            {summary.pending > 0 && (
              <div className="flex gap-3 rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
                <div className="mt-0.5 rounded-full bg-amber-200 p-1 text-amber-900">
                  <ShieldCheck size={12} />
                </div>
                <p className="text-sm text-slate-700">
                  {summary.pending} submission{summary.pending === 1 ? '' : 's'} awaiting admin decision.
                </p>
              </div>
            )}
            {summary.highHazardCount === 0 && summary.pending === 0 && (
              <p className="text-sm text-slate-500">No priority alerts right now.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionDashboardPage;
