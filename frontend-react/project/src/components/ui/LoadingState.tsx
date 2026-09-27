import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  label?: string;
  /** Compact single-line variant for inside buttons/cards. */
  inline?: boolean;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ label = 'Loading…', inline = false }) =>
  inline ? (
    <span className="inline-flex items-center gap-2 text-sm text-ink-600" role="status">
      <Loader2 size={14} className="animate-spin text-mint-600" /> {label}
    </span>
  ) : (
    <div className="flex flex-col items-center justify-center gap-3 py-14 text-ink-600" role="status" aria-live="polite">
      <Loader2 size={28} className="animate-spin text-mint-600" />
      <span className="text-sm">{label}</span>
    </div>
  );

export default LoadingState;
