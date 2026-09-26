import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bot, CheckCircle2, Gauge, Sparkles, ShieldAlert } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { submissionApi } from './submissionApi';
import type { SubmissionResponse } from './types';

const questions = [
  'Does the item contain a lithium-ion battery or charging pack?',
  'Is there visible corrosion, swelling, or chemical leakage?',
  'Has the device been exposed to moisture or fire damage?',
  'Is the waste classified as hazardous by local handling guidelines?',
];

const getAi = (submission: SubmissionResponse | null) =>
  submission?.aiAnalysis ?? submission?.aIAnalysis ?? submission?.AiAnalysis;

const AIAssessmentPage: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState<SubmissionResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [answers, setAnswers] = useState<Record<number, 'Yes' | 'No' | 'Unsure'>>({});

  useEffect(() => {
    if (!id || id === 'new') return;

    const load = async () => {
      try {
        const data = await submissionApi.getById(id);
        setSubmission(data);
      } catch (error) {
        console.error('Failed to load AI assessment', error);
      }
    };

    load();
  }, [id]);

  const ai = getAi(submission);
  const setAnswer = (index: number, value: 'Yes' | 'No' | 'Unsure') => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  };

  const handleGenerateReport = async () => {
    if (!id || id === 'new') {
      navigate('/submissions/report/new');
      return;
    }

    setSaving(true);
    try {
      await submissionApi.updateStatus(id, 'Pending_Approval');
      navigate(`/submissions/report/${id}`);
    } catch (error) {
      console.error('Failed to complete AI assessment', error);
      alert('Unable to generate the report right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/submissions" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-slate-700 ring-1 ring-slate-200 transition hover:bg-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">AI evaluation</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Agentic AI assessment</h1>
          </div>
        </div>
        <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
          {ai?.hazardLevel ? `Hazard level: ${ai.hazardLevel}` : 'Waiting for AI'}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Bot size={18} /></div>
            <h2 className="text-xl font-bold text-slate-900">Dynamic AI questions</h2>
          </div>

          <div className="mt-6 space-y-5">
            {questions.map((question, index) => (
              <div key={question} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">{index + 1}. {question}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(['Yes', 'No', 'Unsure'] as const).map((answer) => (
                    <button
                      key={answer}
                      onClick={() => setAnswer(index, answer)}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${answers[index] === answer ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/15' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'}`}
                    >
                      {answer}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? 'Generating report...' : 'Generate report'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-700 p-6 text-white shadow-lg shadow-emerald-500/15">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-50">Hazard level</p>
              <Gauge size={18} className="text-emerald-100" />
            </div>
            <div className="mt-8 text-center">
              <div className="text-5xl font-bold">{ai?.hazardLevel ?? '—'}</div>
              <p className="mt-2 text-emerald-50/90">Risk classification from AI analysis</p>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <h3 className="text-lg font-bold text-slate-900">Decision summary</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-3"><CheckCircle2 size={16} className="text-emerald-600" /> Hazard class: {ai?.hazardLevel ?? 'Pending'}</li>
              <li className="flex items-center gap-3"><ShieldAlert size={16} className="text-amber-600" /> Human review: {ai?.requiresHumanApproval ? 'Recommended' : 'Not required'}</li>
              <li className="flex items-center gap-3"><Sparkles size={16} className="text-sky-600" /> Category: {ai?.wasteCategory ?? submission?.category ?? 'Waiting for AI analysis'}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssessmentPage;
