import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Send, PackageSearch, ClipboardList, ArrowRight, Truck, CheckCircle2, Loader2,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { submissionApi } from '../submissions/submissionApi';
import { IN_PROGRESS_STATUSES, type SubmissionResponse } from '../submissions/types';
import { materialRequestApi } from '../sales/MaterialRequests/materialRequestApi';
import { GlassCard, LoadingState } from '../../components/ui';
import recyclingSceneImg from '../../assets/ewaste/recycling-scene.jpg';

const DONE_STATUSES = ['CollectorAssigned', 'AwaitingCollector', 'Collected', 'Closed'];

const CustomerHomePage: React.FC = () => {
  const { user } = useAuth() as unknown as { user: { fullName?: string; role: string } | null };
  const isCorporate = user?.role?.toLowerCase() === 'corporate';

  const [submissions, setSubmissions] = useState<SubmissionResponse[] | null>(null);
  const [requestCount, setRequestCount] = useState<number | null>(null);

  useEffect(() => {
    submissionApi.mine().then(setSubmissions).catch(() => setSubmissions([]));
    if (isCorporate) {
      materialRequestApi.listMine().then((r) => setRequestCount(r.length)).catch(() => setRequestCount(null));
    }
  }, [isCorporate]);

  const inProgress = submissions?.filter((s) => IN_PROGRESS_STATUSES.includes(s.status)).length ?? 0;
  const completed = submissions?.filter((s) => DONE_STATUSES.includes(s.status)).length ?? 0;

  const firstName = user?.fullName?.split(' ')[0];

  return (
    <div className="mx-auto max-w-4xl">
      <GlassCard hover={false} className="mb-6 overflow-hidden p-2">
        <div className="grid items-center sm:grid-cols-[1.3fr_1fr]">
          <div className="p-6 md:p-8">
            <p className="mb-1 font-mono text-xs uppercase tracking-widest text-mint-700">
              {isCorporate ? 'Corporate account' : 'Household account'}
            </p>
            <h1 className="font-display text-3xl font-bold text-ink-900">
              Welcome back{firstName ? `, ${firstName}` : ''}.
            </h1>
            <p className="mt-3 max-w-md text-sm text-ink-600">
              Submit e-waste for pickup and track it all the way to collection — our AI reads the category
              and hazard level the moment you submit.
            </p>
            <Link to="/submissions/new" className="btn-glass mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold">
              <Send size={14} /> Submit an item
            </Link>
          </div>
          <img
            src={recyclingSceneImg}
            alt="Illustration of a recycling bin full of electronics, with a collection truck and a recycling plant"
            className="hidden h-60 w-full rounded-[1.25rem] object-cover object-[center_40%] sm:block"
          />
        </div>
      </GlassCard>

      {submissions === null ? (
        <LoadingState label="Loading your activity…" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-3 mb-6">
          <StatTile icon={Loader2} spin={inProgress > 0} label="In progress" value={inProgress} tone="amber" />
          <StatTile icon={CheckCircle2} label="Completed" value={completed} tone="mint" />
          {isCorporate && requestCount !== null && (
            <StatTile icon={ClipboardList} label="Material requests" value={requestCount} tone="sky" />
          )}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <ActionCard
          icon={Send}
          title="Submit an item"
          desc="Describe a device you want collected and get an instant AI assessment."
          to="/submissions/new"
          cta="Submit item"
        />
        <ActionCard
          icon={PackageSearch}
          title="My submissions"
          desc="See the live status of everything you've submitted, from analysis to collection."
          to="/submissions/mine"
          cta="View submissions"
        />
        {isCorporate && (
          <ActionCard
            icon={ClipboardList}
            title="Material requests"
            desc="Request recovered material by type and quantity — even ahead of restock."
            to="/material-requests"
            cta="View requests"
            className="sm:col-span-2"
          />
        )}
      </div>
    </div>
  );
};

const TONE_BG: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700',
  mint: 'bg-mint-100 text-mint-700',
  sky: 'bg-sky-100 text-sky-700',
};

const StatTile: React.FC<{ icon: React.ElementType; label: string; value: number; tone: string; spin?: boolean }> = ({
  icon: Icon, label, value, tone, spin,
}) => (
  <GlassCard hover={false} className="p-5 flex items-center gap-3">
    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${TONE_BG[tone]}`}>
      <Icon size={18} className={spin ? 'animate-spin' : ''} />
    </span>
    <div>
      <div className="font-display text-xl font-bold text-ink-900">{value}</div>
      <div className="text-xs text-ink-600">{label}</div>
    </div>
  </GlassCard>
);

const ActionCard: React.FC<{
  icon: React.ElementType; title: string; desc: string; to: string; cta: string; className?: string;
}> = ({ icon: Icon, title, desc, to, cta, className = '' }) => (
  <Link to={to} className="block">
    <GlassCard className={`p-6 ${className}`}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 flex items-center justify-center text-white mb-4 shadow-md shadow-mint-500/30">
        <Icon size={18} />
      </div>
      <h3 className="font-display font-bold text-ink-900 mb-1.5">{title}</h3>
      <p className="text-sm text-ink-600 leading-relaxed mb-3">{desc}</p>
      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-mint-700">
        {cta} <ArrowRight size={14} />
      </span>
    </GlassCard>
  </Link>
);

export default CustomerHomePage;
