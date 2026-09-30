import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { tabMatches, type NavTab } from './navigation';

/** Tab bar for the pages that share one sidebar entry (e.g. Collection → Jobs | Collectors). */
export const SectionTabs: React.FC<{ tabs: NavTab[] }> = ({ tabs }) => {
  const { pathname } = useLocation();

  return (
    <nav aria-label="Section pages" className="glass mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-2xl p-1">
      {tabs.map((tab) => {
        const active = tabMatches(tab, pathname);
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={[
              'rounded-xl px-4 py-2 text-sm transition-colors duration-150',
              active ? 'bg-mint-600 font-semibold text-white shadow-md shadow-mint-500/30' : 'font-medium text-ink-800 hover:bg-mint-50',
            ].join(' ')}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
};

export default SectionTabs;
