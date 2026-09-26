import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

/** 1 … 4 5 [6] 7 8 … 20 — always includes first, last and a window around the current page. */
const pageWindow = (page: number, totalPages: number): (number | 'gap')[] => {
  const wanted = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
};

export const Pagination: React.FC<PaginationProps> = ({ page, totalPages, totalCount, pageSize, onPageChange, disabled = false }) => {
  if (totalCount === 0) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalCount);
  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-4">
      <p className="text-xs text-ink-600">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{totalCount}</strong>
      </p>
      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button
            type="button"
            className={`${btn} text-ink-800 hover:bg-mint-50`}
            disabled={disabled || page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={14} />
          </button>
          {pageWindow(page, totalPages).map((p, i) =>
            p === 'gap' ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-ink-600">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                disabled={disabled}
                onClick={() => onPageChange(p)}
                aria-current={p === page ? 'page' : undefined}
                className={`${btn} ${p === page ? 'bg-mint-600 text-white shadow-md shadow-mint-500/30' : 'text-ink-800 hover:bg-mint-50'}`}
              >
                {p}
              </button>
            ),
          )}
          <button
            type="button"
            className={`${btn} text-ink-800 hover:bg-mint-50`}
            disabled={disabled || page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={14} />
          </button>
        </nav>
      )}
    </div>
  );
};

export default Pagination;
