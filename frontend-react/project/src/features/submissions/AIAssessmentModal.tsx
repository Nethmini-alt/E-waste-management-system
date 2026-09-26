import React, { useState } from 'react';
import { Bot, X } from 'lucide-react';

export type AssessmentAnswerValue = 'Yes' | 'No' | 'Unsure';

export interface SubmittedAssessmentAnswer {
  question: string;
  answer: AssessmentAnswerValue;
}

// Single source of truth for the questions — both submission pages import
// this so the modal, the payload, and (if you ever need it) any admin view
// all agree on the same wording.
export const AI_ASSESSMENT_QUESTIONS = [
  'Does the item contain a lithium-ion battery or charging pack?',
  'Is there visible corrosion, swelling, or chemical leakage?',
  'Has the device been exposed to moisture or fire damage?',
  'Is the waste classified as hazardous by local handling guidelines?',
];

interface AIAssessmentModalProps {
  open: boolean;
  submitting?: boolean;
  onCancel: () => void;
  onComplete: (answers: SubmittedAssessmentAnswer[]) => void;
}

// Mandatory pre-submit step: shown after the user fills in the form (and,
// for the individual flow, picks an image) and before the actual POST to
// the backend. It never navigates anywhere itself — the parent page owns
// what happens with the answers.
const AIAssessmentModal: React.FC<AIAssessmentModalProps> = ({ open, submitting, onCancel, onComplete }) => {
  const [answers, setAnswers] = useState<Record<number, AssessmentAnswerValue>>({});

  if (!open) return null;

  const allAnswered = AI_ASSESSMENT_QUESTIONS.every((_, index) => answers[index] !== undefined);

  const setAnswer = (index: number, value: AssessmentAnswerValue) => {
    setAnswers((prev) => ({ ...prev, [index]: value }));
  };

  const handleContinue = () => {
    if (!allAnswered || submitting) return;
    const payload: SubmittedAssessmentAnswer[] = AI_ASSESSMENT_QUESTIONS.map((question, index) => ({
      question,
      answer: answers[index],
    }));
    onComplete(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Bot size={18} /></div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Required before submitting</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900">AI hazard assessment</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Answer all 4 questions about this item. Your answers are sent to the backend together with your submission and used alongside the AI analysis.
        </p>

        <div className="mt-6 max-h-[55vh] space-y-4 overflow-y-auto pr-1">
          {AI_ASSESSMENT_QUESTIONS.map((question, index) => (
            <div key={question} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-800">{index + 1}. {question}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(['Yes', 'No', 'Unsure'] as const).map((answer) => (
                  <button
                    key={answer}
                    type="button"
                    onClick={() => setAnswer(index, answer)}
                    className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                      answers[index] === answer
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/15'
                        : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {answer}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {!allAnswered && (
          <p className="mt-4 text-xs font-medium text-amber-600">All 4 questions are mandatory — answer each one to continue.</p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Back to form
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!allAnswered || submitting}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? 'Submitting...' : 'Confirm & submit'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIAssessmentModal;