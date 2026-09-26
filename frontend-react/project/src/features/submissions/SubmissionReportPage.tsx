import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Download, FileText, Leaf, ShieldAlert, Sparkles } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { submissionApi } from './submissionApi';
import type { SubmissionResponse } from './types';

const accentClasses: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  sky: 'bg-sky-50 text-sky-700 ring-sky-100',
  lime: 'bg-lime-50 text-lime-700 ring-lime-100',
  amber: 'bg-amber-50 text-amber-700 ring-amber-100',
};

const getAi = (submission: SubmissionResponse | null) =>
  submission?.aiAnalysis ?? submission?.aIAnalysis ?? submission?.AiAnalysis;

const SubmissionReportPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [working, setWorking] = useState(false);

  const ai = getAi(submission);
  const firstItem = submission?.items?.[0];

  const isTerminalStatus = (status?: string) => status === 'Approved' || status === 'Rejected';

  useEffect(() => {
    if (!id || id === 'new') return;

    let cancelled = false;
    let intervalId: number | undefined;

    const load = async () => {
      try {
        const data = await submissionApi.getById(id);
        if (cancelled) return;
        setSubmission(data);
        // Once the submission has a final decision, nothing else will
        // change — stop polling instead of hitting the API forever.
        if (isTerminalStatus(data.status) && intervalId !== undefined) {
          window.clearInterval(intervalId);
          intervalId = undefined;
        }
      } catch (error) {
        console.error('Failed to load submission report', error);
      }
    };

    load();
    intervalId = window.setInterval(load, 3000);

    return () => {
      cancelled = true;
      if (intervalId !== undefined) {
        window.clearInterval(intervalId);
      }
    };
  }, [id]);

  const recyclableText = ai?.hazardLevel
    ? ai.hazardLevel.toLowerCase() === 'low' || ai.hazardLevel.toLowerCase() === 'medium'
      ? 'Suitable for recycling with standard processing.'
      : 'Requires specialist handling and safer recycling workflow.'
    : 'Awaiting AI classification';

  const metrics = [
    { label: 'Waste category', value: ai?.wasteCategory || submission?.category || 'Pending', accent: 'emerald' },
    { label: 'Estimated value', value: ai?.estimatedValueUsd ? `$${Number(ai.estimatedValueUsd).toFixed(2)}` : 'Pending', accent: 'sky' },
    { label: 'Recovered impact', value: ai?.estimatedVolumeKg ? `${Number(ai.estimatedVolumeKg).toFixed(1)} kg` : 'Pending', accent: 'lime' },
    { label: 'Hazard level', value: ai?.hazardLevel || 'Pending', accent: 'amber' },
  ];

  const handleDecision = async (status: 'Approved' | 'Rejected' | 'Pending_Approval') => {
    if (!id) return;
    setWorking(true);
    try {
      await submissionApi.updateStatus(id, status);
      navigate('/submissions/history');
    } catch (error) {
      console.error('Failed to update submission status', error);
      alert('Unable to update the submission status.');
    } finally {
      setWorking(false);
    }
  };

  const handleDownloadPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/submissions/history" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-slate-700 ring-1 ring-slate-200 transition hover:bg-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Submission report</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              {id && id !== 'new' && submission ? submission.id.slice(0, 8).toUpperCase() : 'Draft report'}
            </h1>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDownloadPdf}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
        >
          <Download size={16} /> Download PDF
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ label, value, accent }) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
            <div className={`inline-flex rounded-xl p-2 ring-1 ${accentClasses[accent]}`}>
              <FileText size={18} />
            </div>
            <div className="mt-4 text-2xl font-bold text-slate-900">{value}</div>
            <p className="mt-1 text-sm text-slate-600">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <h2 className="text-xl font-bold text-slate-900">Report summary</h2>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Classification</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{ai?.wasteCategory || submission?.category || 'Awaiting classification'}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Environmental assessment</p>
              <div className="mt-3 flex items-center gap-2 text-slate-800">
                <Leaf size={18} className="text-emerald-600" />
                <span className="font-semibold">{firstItem?.description || 'High recovery potential with responsible recycling pathway.'}</span>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Recycling recommendation</p>
              <p className="mt-2 text-slate-700">{recyclableText}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pickup detail</p>
              <p className="mt-2 text-slate-700">{submission?.pickupAddress || 'No pickup address recorded.'}</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-lg shadow-slate-900/10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200">Approval status</p>
          <h2 className="mt-3 text-2xl font-bold">{submission?.status || 'Pending'}</h2>
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
              <span className="flex items-center gap-2 text-sm"><CheckCircle2 size={16} className="text-emerald-300" /> AI review</span>
              <span className="font-semibold text-emerald-300">{ai ? 'Passed' : 'Pending'}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
              <span className="flex items-center gap-2 text-sm"><ShieldAlert size={16} className="text-amber-300" /> Human approval</span>
              <span className="font-semibold text-amber-300">{ai?.requiresHumanApproval ? 'Required' : 'Not required'}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
              <span className="flex items-center gap-2 text-sm"><Sparkles size={16} className="text-sky-300" /> Collection plan</span>
              <span className="font-semibold text-sky-300">{ai ? 'Ready' : 'Waiting'}</span>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={working}
              onClick={() => handleDecision('Approved')}
              className="flex-1 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => handleDecision('Pending_Approval')}
              className="flex-1 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Request review
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubmissionReportPage;