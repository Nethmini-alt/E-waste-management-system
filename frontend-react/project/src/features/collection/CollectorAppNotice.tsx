import React from 'react';
import { Smartphone, LogOut } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';

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
    <div className="relative flex min-h-screen items-center justify-center p-6">
      <div className="circuit-bg" />
      <div className="glass relative z-10 w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-100 text-mint-700">
          <Smartphone size={28} aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-xl font-bold text-ink-900">Use the collector app</h1>
        <p className="mt-2 text-sm text-ink-600">
          {user?.fullName ? `Hi ${user.fullName.split(' ')[0]}, your` : 'Your'} pickups, navigation and
          collection photos are in the E-Waste collector app on your phone. Sign in there with the same
          email and password.
        </p>
        <button
          type="button"
          onClick={logout}
          className="btn-glass-light mx-auto mt-6 flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-mint-500"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </div>
  );
};

export default CollectorAppNotice;
