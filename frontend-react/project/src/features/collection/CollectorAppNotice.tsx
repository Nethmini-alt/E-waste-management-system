import React from 'react';
import { Smartphone, LogOut, MapPin, Camera, Navigation } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import Hero3D from '../../components/Hero3D';

const FEATURES = [
  { icon: Navigation, label: 'Turn-by-turn navigation' },
  { icon: Camera, label: 'Proof-of-collection photos' },
  { icon: MapPin, label: 'Live pickup addresses' },
];

// Collectors work from the Flutter app (live GPS, camera, navigation).
// If one signs in to the web app, point them there instead of showing
// the staff/sales shell, which has nothing for them.
const CollectorAppNotice: React.FC = () => {
  // AuthContext is plain JS, so give its shape a type here.
  const { user, logout } = useAuth() as unknown as {
    user: { fullName?: string } | null;
    logout: () => void;
  };
  return (
    <div className="relative flex min-h-screen items-center justify-center p-6 overflow-hidden">
      <div className="circuit-bg" />
      <div className="absolute inset-0 z-0">
        <Hero3D density="lite" />
      </div>
      <div className="bg-blob blob-1" style={{ opacity: 0.18 }} />
      <div className="bg-blob blob-2" style={{ opacity: 0.18 }} />

      <div className="glass relative z-10 w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-mint-400 to-mint-700 text-white shadow-lg shadow-mint-500/30">
          <Smartphone size={30} aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-xl font-bold text-ink-900">
          {user?.fullName ? `Hi ${user.fullName.split(' ')[0]}, use the collector app` : 'Use the collector app'}
        </h1>
        <p className="mt-2 text-sm text-ink-600 leading-relaxed">
          Your pickups, navigation and collection photos live in the E-Waste collector app on your phone.
          Sign in there with the same email and password to get started.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-2.5 text-left">
          {FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl bg-white/60 px-3.5 py-2.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-mint-50 text-mint-700">
                <Icon size={15} />
              </span>
              <span className="text-sm font-medium text-ink-800">{label}</span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={logout}
          className="btn-glass-light mx-auto mt-7 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <footer className="fixed inset-x-0 bottom-4 z-10 flex justify-center px-4">
        <div className="glass rounded-full px-4 py-1.5 text-[11px] text-ink-600">
          © {new Date().getFullYear()} E-Waste Management System
        </div>
      </footer>
    </div>
  );
};

export default CollectorAppNotice;
