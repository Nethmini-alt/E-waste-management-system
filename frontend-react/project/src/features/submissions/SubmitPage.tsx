import React from 'react';
import { ArrowRight, PlusCircle, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const SubmitPage: React.FC = () => {
  const options = [
    {
      title: 'Individual submission',
      description: 'Submit one household or personal e-waste item and follow the AI risk assessment.',
      path: '/submissions/individual',
      accent: 'emerald',
      icon: PlusCircle,
    },
    {
      title: 'Cooperative submission',
      description: 'Submit a group or community collection batch with a single pickup record.',
      path: '/submissions/cooperative',
      accent: 'sky',
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Create intake</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">Choose a submission type</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {options.map(({ title, description, path, accent, icon: Icon }) => (
          <div key={title} className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm">
            <div className={`inline-flex rounded-2xl p-3 ring-1 ${accent === 'emerald' ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-sky-50 text-sky-700 ring-sky-100'}`}>
              <Icon size={22} />
            </div>

            <h2 className="mt-5 text-xl font-bold text-slate-900">{title}</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>

            <Link
              to={path}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Open form <ArrowRight size={16} />
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SubmitPage;