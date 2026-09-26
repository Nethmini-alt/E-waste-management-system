import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Bot, Leaf, MapPin, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { submissionApi } from './submissionApi';
import { parseApiValidationErrors } from './apiErrors';
import AIAssessmentModal, { type SubmittedAssessmentAnswer } from './AIAssessmentModal';

const IndividualSubmissionPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [showAssessment, setShowAssessment] = useState(false);
  const [form, setForm] = useState({
    itemType: '',
    category: 'Electronics',
    quantity: '',
    weight: '',
    pickupAddress: '',
    phoneNumber: '',
    description: '',
  });

  const updateField = (field: string, value: string) => setForm((prev) => ({ ...prev, [field]: value }));

  const validate = (): string[] => {
    const problems: string[] = [];
    if (!form.itemType.trim()) problems.push('Item type is required.');
    if (!form.weight || Number(form.weight) <= 0) problems.push('Estimated weight must be greater than 0.');
    if (!form.pickupAddress.trim()) problems.push('Pickup address is required.');
    if (!form.phoneNumber.trim()) problems.push('Contact number is required.');
    return problems;
  };

  // Step 1: validate the form itself. If it's clean, open the mandatory AI
  // assessment modal instead of posting straight away — nothing is sent to
  // the backend yet.
  const handleSubmitClick = () => {
    const validationProblems = validate();
    if (validationProblems.length > 0) {
      setErrors(validationProblems);
      return;
    }

    setErrors([]);
    setShowAssessment(true);
  };

  // Step 2: only once the assessment modal reports all 4 questions
  // answered do we actually build the payload and call the API.
  const handleAssessmentComplete = async (assessmentAnswers: SubmittedAssessmentAnswer[]) => {
    setLoading(true);
    try {
      // userType/userId are for display only — the backend always records
      // the submission under the authenticated caller regardless of what's
      // sent here, so there's nothing sensitive in sending the user's own role.
      const payload = {
        userId: (user as any)?.userId ?? '',
        userType: (user as any)?.role ?? 'Household',
        category: form.category,
        estimatedWeight: Number(form.weight || 0),
        pickupAddress: form.pickupAddress,
        phoneNumber: form.phoneNumber,
        assessmentAnswers,
        items: [
          {
            itemName: form.itemType,
            description: form.description,
            imageUrl: uploadedFileName ?? '',
          },
        ],
      };

      const response = await submissionApi.create(payload);
      navigate(`/submissions/report/${response.id}`);
    } catch (error) {
      console.error('Failed to create submission', error);
      setShowAssessment(false);
      setErrors(parseApiValidationErrors(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDraft = () => {
    navigate('/submissions/history');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setUploadedFileName(selectedFile.name);
    event.target.value = '';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/submissions" className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 text-slate-700 ring-1 ring-slate-200 transition hover:bg-white">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Individual intake</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Submit a single item</h1>
          </div>
        </div>
        <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Live backend</div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Item type
              <input value={form.itemType} onChange={(e) => updateField('itemType', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Category
              <select value={form.category} onChange={(e) => updateField('category', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white">
                <option>Electronics</option>
                <option>Battery</option>
                <option>Metal</option>
                <option>Composite</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Estimated weight (kg)
              <input type="number" step="0.1" value={form.weight} onChange={(e) => updateField('weight', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Contact number
              <input value={form.phoneNumber} onChange={(e) => updateField('phoneNumber', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
              Pickup address
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={16} />
                <input value={form.pickupAddress} onChange={(e) => updateField('pickupAddress', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
              </div>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
              Item description
              <textarea rows={4} value={form.description} onChange={(e) => updateField('description', e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-slate-900">Upload supporting images</p>
                <p className="text-sm text-slate-600">JPEG, PNG, or HEIC up to 10MB.</p>
                {uploadedFileName ? (
                  <p className="mt-2 text-sm font-medium text-emerald-700">Selected file: {uploadedFileName}</p>
                ) : null}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/heic"
                className="hidden"
                onChange={handleFileChange}
              />
              <button
                type="button"
                onClick={handleUploadClick}
                className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm ring-1 ring-emerald-100 transition hover:bg-emerald-50"
              >
                <UploadCloud size={16} /> Upload
              </button>
            </div>
          </div>

          {errors.length > 0 && (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-red-700">
                <AlertCircle size={16} /> Please fix the following:
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-700">
                {errors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={handleDraft} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Save draft
            </button>
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={loading}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Submitting...' : 'Submit item'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-lg shadow-slate-900/10">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">AI readiness</p>
            <h2 className="mt-3 text-2xl font-bold">Assessment preview</h2>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
                <span className="flex items-center gap-2 text-sm"><Bot size={16} className="text-emerald-300" /> Risk level</span>
                <span className="font-semibold text-amber-300">Calculated after submission</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
                <span className="flex items-center gap-2 text-sm"><Leaf size={16} className="text-emerald-300" /> Environmental impact</span>
                <span className="font-semibold text-emerald-300">Live analysis</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
                <span className="flex items-center gap-2 text-sm"><ShieldCheck size={16} className="text-emerald-300" /> Confidence</span>
                <span className="font-semibold text-emerald-300">Pending AI</span>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <h3 className="text-lg font-bold text-slate-900">Submission checklist</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Sparkles size={12} /></span> Item details captured</li>
              <li className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Sparkles size={12} /></span> Hazard screening required</li>
              <li className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Sparkles size={12} /></span> Pickup route prepared</li>
              <li className="flex items-center gap-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"><Sparkles size={12} /></span> Environmental credit available</li>
            </ul>
          </div>
        </div>
      </div>

      <AIAssessmentModal
        open={showAssessment}
        submitting={loading}
        onCancel={() => setShowAssessment(false)}
        onComplete={handleAssessmentComplete}
      />
    </div>
  );
};

export default IndividualSubmissionPage;