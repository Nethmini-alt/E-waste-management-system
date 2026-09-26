import React, { useRef, useState } from 'react';
import { AlertCircle, ArrowLeft, Building2, CheckCircle2, MapPinned, Plus, UploadCloud, Users } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { submissionApi } from './submissionApi';
import { parseApiValidationErrors } from './apiErrors';
import AIAssessmentModal, { type SubmittedAssessmentAnswer } from './AIAssessmentModal';

const parseCsvMemberNames = (csvText: string): string[] => {
  const rows = csvText
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  const names = new Set<string>();

  rows.forEach((row) => {
    const cells = row
      .split(',')
      .map((cell) => cell.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);

    if (cells.length === 0) {
      return;
    }

    const normalized = cells.map((cell) => cell.toLowerCase());
    const nameIndex = normalized.findIndex((cell) => ['name', 'participant', 'member'].includes(cell));

    if (nameIndex >= 0 && cells[nameIndex]) {
      if (cells[nameIndex].trim().length > 1 && /\s/.test(cells[nameIndex])) {
        names.add(cells[nameIndex]);
      }
      return;
    }

    cells.forEach((cell) => {
      const trimmedCell = cell.trim();
      if (trimmedCell.length > 2 && /\s/.test(trimmedCell) && !/^(name|participant|member|phone|email|role|status|weight)$/i.test(trimmedCell)) {
        names.add(trimmedCell);
      }
    });
  });

  return Array.from(names);
};

const CooperativeSubmissionPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploadedCsvName, setUploadedCsvName] = useState<string | null>(null);
  const [teamMembersState, setTeamMembersState] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [showAssessment, setShowAssessment] = useState(false);
  const [form, setForm] = useState({
    groupName: '',
    coordinator: '',
    collectionLocation: '',
    summary: '',
    phoneNumber: '',
    estimatedWeight: '',
  });

  const validate = (): string[] => {
    const problems: string[] = [];
    if (!form.groupName.trim()) problems.push('Group name is required.');
    if (!form.coordinator.trim()) problems.push('Coordinator name is required.');
    if (!form.collectionLocation.trim()) problems.push('Collection location is required.');
    if (!form.phoneNumber.trim()) problems.push('Contact number is required.');
    if (!form.estimatedWeight || Number(form.estimatedWeight) <= 0) {
      problems.push('Estimated weight must be greater than 0.');
    }
    return problems;
  };

  // Step 1: validate the form. If clean, open the mandatory AI assessment
  // modal — nothing is sent to the backend yet.
  const handleSubmitClick = () => {
    const validationProblems = validate();
    if (validationProblems.length > 0) {
      setErrors(validationProblems);
      return;
    }

    setErrors([]);
    setShowAssessment(true);
  };

  // Step 2: only once all 4 assessment questions are answered do we build
  // the payload and actually call the API.
  const handleAssessmentComplete = async (assessmentAnswers: SubmittedAssessmentAnswer[]) => {
    setLoading(true);
    try {
      // Note: registered participants aren't sent to the backend yet — there's
      // no field on Submission/CreateSubmissionDto to store them. They're
      // captured here for the coordinator's own reference, but not persisted
      // server-side until that's added.
      const response = await submissionApi.create({
        userId: (user as any)?.userId ?? '',
        userType: 'Cooperative',
        category: 'Mixed Electronics',
        estimatedWeight: Number(form.estimatedWeight || 0),
        pickupAddress: form.collectionLocation,
        phoneNumber: form.phoneNumber,
        assessmentAnswers,
        items: [
          {
            itemName: form.groupName,
            description: `${form.summary} Coordinator: ${form.coordinator}`,
            imageUrl: '',
          },
        ],
      });

      navigate(`/submissions/report/${response.id}`);
    } catch (error) {
      console.error('Failed to submit cooperative batch', error);
      setShowAssessment(false);
      setErrors(parseApiValidationErrors(error));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBatch = () => {
    navigate('/submissions/history');
  };

  const handleAddMember = () => {
    const nextMember = window.prompt('Enter participant name');
    const trimmedName = nextMember?.trim();

    if (!trimmedName) {
      return;
    }

    setTeamMembersState((prev) => {
      if (prev.includes(trimmedName)) {
        return prev;
      }

      return [...prev, trimmedName];
    });
  };

  const handleCsvUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCsvFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) {
      return;
    }

    setUploadedCsvName(selectedFile.name);

    const csvText = await selectedFile.text();
    const importedMembers = parseCsvMemberNames(csvText);

    if (importedMembers.length === 0) {
      alert('No participant names were found in the CSV file. Please use a file with names in a single column or a header named Name.');
      event.target.value = '';
      return;
    }

    setTeamMembersState((prev) => {
      const nextMembers = [...prev];
      importedMembers.forEach((member) => {
        if (!nextMembers.includes(member)) {
          nextMembers.push(member);
        }
      });
      return nextMembers;
    });

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
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Cooperative intake</p>
            <h1 className="mt-1 text-3xl font-bold text-slate-900">Submit as a group</h1>
          </div>
        </div>
        <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Group batch</div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
          <div className="grid gap-5 md:grid-cols-2">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Group name
              <input value={form.groupName} onChange={(e) => setForm({ ...form, groupName: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Coordinator
              <input value={form.coordinator} onChange={(e) => setForm({ ...form, coordinator: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Estimated weight (kg)
              <input type="number" value={form.estimatedWeight} onChange={(e) => setForm({ ...form, estimatedWeight: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Contact number
              <input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
              Collection location
              <div className="relative">
                <MapPinned className="pointer-events-none absolute left-3 top-3.5 text-slate-400" size={16} />
                <input value={form.collectionLocation} onChange={(e) => setForm({ ...form, collectionLocation: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
              </div>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
              Shared waste summary
              <textarea rows={4} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-emerald-400 focus:bg-white" />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-slate-800">
                <Users size={18} className="text-emerald-700" />
                <span className="font-semibold">Registered participants</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAddMember}
                  className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                >
                  <Plus size={14} /> Add member
                </button>
                <button
                  type="button"
                  onClick={handleCsvUploadClick}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  <UploadCloud size={14} /> Upload CSV
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  aria-label="Upload CSV"
                  className="hidden"
                  onChange={handleCsvFileChange}
                />
              </div>
            </div>
            {uploadedCsvName ? (
              <p className="mt-3 text-sm font-medium text-emerald-700">Selected CSV: {uploadedCsvName}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              {teamMembersState.map((member) => (
                <span key={member} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700">{member}</span>
              ))}
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
            <button type="button" onClick={handleSaveBatch} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
              Save batch
            </button>
            <button
              type="button"
              onClick={handleSubmitClick}
              disabled={loading}
              className="rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/20 transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? 'Submitting...' : 'Submit cooperative batch'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-sky-600 to-cyan-700 p-6 text-white shadow-lg shadow-sky-500/15">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-100">Group impact</p>
            <h2 className="mt-3 text-3xl font-bold">{form.estimatedWeight || 0} kg</h2>
            <p className="mt-2 text-sky-50/90">Estimated reusable material recovered from this cooperative batch.</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><Building2 size={18} /></div>
              <h3 className="text-lg font-bold text-slate-900">Processing summary</h3>
            </div>
            <ul className="mt-5 space-y-3 text-sm text-slate-600">
              <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                <span>Registered participants</span>
                <span className="font-semibold text-slate-900">{teamMembersState.length}</span>
              </li>
              <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                <span>Collection location set</span>
                {form.collectionLocation ? (
                  <CheckCircle2 size={16} className="text-emerald-600" />
                ) : (
                  <span className="text-xs font-semibold text-amber-600">Not set</span>
                )}
              </li>
              <li className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2">
                <span>Material value estimate</span>
                <span className="font-semibold text-slate-900">Pending AI analysis</span>
              </li>
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

export default CooperativeSubmissionPage;