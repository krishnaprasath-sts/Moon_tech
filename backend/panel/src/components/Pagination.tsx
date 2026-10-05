import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PaginationMeta } from '../types';

interface PaginationProps {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ meta, onPageChange }) => {
  if (!meta || !meta.total) return null;

  const limit = Number(meta.limit) > 0 ? Number(meta.limit) : 10;
  const page = Number(meta.page) > 0 ? Number(meta.page) : 1;
  const total = Number(meta.total) || 0;
  const totalPages = Number(meta.totalPages) > 0 ? Number(meta.totalPages) : Math.max(1, Math.ceil(total / limit));
  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);

  const buttonClass =
    'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition text-xs font-medium shadow-sm';

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 px-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#000000]/40 text-xs text-slate-600 dark:text-slate-400 transition-colors duration-200"
    >
      <div>
        Showing <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{startItem}</span> to{' '}
        <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{endItem}</span> of{' '}
        <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{total.toLocaleString('en-IN')}</span>{' '}
        records
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className={buttonClass}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <span
            aria-current="page"
            className="px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 font-semibold text-xs border border-brand-200 dark:border-brand-500/30 tabular-nums whitespace-nowrap"
          >
            Page {page} of {totalPages}
          </span>

          <button
            type="button"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            aria-label="Next page"
            className={buttonClass}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </nav>
  );
};
