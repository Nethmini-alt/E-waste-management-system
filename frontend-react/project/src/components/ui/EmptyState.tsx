import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon: Icon = Inbox, action }) => (
  <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-mint-50 text-mint-600">
      <Icon size={26} />
    </div>
    <h4 className="font-display text-base font-bold text-ink-900">{title}</h4>
    {description && <p className="max-w-sm text-sm text-ink-600">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export default EmptyState;
