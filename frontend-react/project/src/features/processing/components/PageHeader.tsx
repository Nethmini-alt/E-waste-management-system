import React from 'react';
import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon: Icon, actions }) => (
  <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 className="flex items-center gap-2.5 font-display text-2xl font-bold text-ink-900">
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-mint-400 to-mint-700 text-white shadow-md shadow-mint-500/30">
            <Icon size={18} />
          </span>
        )}
        {title}
      </h2>
      {subtitle && <p className="mt-1 text-sm text-ink-600">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);

export default PageHeader;
