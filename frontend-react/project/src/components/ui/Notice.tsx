import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type NoticeTone = 'success' | 'info' | 'warning' | 'error';

const TONES: Record<NoticeTone, { box: string; Icon: React.ElementType }> = {
  success: { box: 'bg-mint-50 text-mint-800 border-mint-200', Icon: CheckCircle2 },
  info: { box: 'bg-sky-50 text-sky-800 border-sky-200', Icon: Info },
  warning: { box: 'bg-amber-50 text-amber-900 border-amber-200', Icon: AlertTriangle },
  error: { box: 'bg-red-50 text-red-800 border-red-200', Icon: AlertCircle },
};

interface NoticeProps {
  tone: NoticeTone;
  title?: string;
  children?: React.ReactNode;
  className?: string;
}

/** Inline banner used for success / info / warning feedback (in place of alert()). */
export const Notice: React.FC<NoticeProps> = ({ tone, title, children, className = '' }) => {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${box} ${className}`}
    >
      <Icon size={18} className="mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
    </div>
  );
};

export default Notice;
