import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PaginationMeta } from '../types';

interface PaginationProps {
  meta?: PaginationMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

function getPaginationRange(currentPage: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  if (currentPage <= 4) {
    return [1, 2, 3, 4, 5, 'ellipsis', totalPages];
  }

  if (currentPage >= totalPages - 3) {
    return [1, 'ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
  }

  return [1, 'ellipsis', currentPage - 1, currentPage, currentPage + 1, 'ellipsis', totalPages];
}

export const Pagination: React.FC<PaginationProps> = ({ meta, onPageChange, disabled = false }) => {
  const [jumpPage, setJumpPage] = useState('');

  if (!meta || meta.total === 0) return null;

  const limit = Math.max(1, Number(meta.limit) || 10);
  const total = Number(meta.total) || 0;
  const totalPages = Math.max(1, Number(meta.totalPages) || Math.ceil(total / limit));
  const page = Math.min(Math.max(1, Number(meta.page) || 1), totalPages);

  const startItem = Math.min((page - 1) * limit + 1, total);
  const endItem = Math.min(page * limit, total);
  const pages = getPaginationRange(page, totalPages);

  const handlePageClick = (targetPage: number) => {
    if (disabled || targetPage === page || targetPage < 1 || targetPage > totalPages) return;
    onPageChange(targetPage);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpPage, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages && parsed !== page) {
      onPageChange(parsed);
      setJumpPage('');
    }
  };

  const navButtonClass =
    'inline-flex items-center justify-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white disabled:opacity-40 disabled:pointer-events-none transition text-xs font-medium shadow-sm cursor-pointer select-none';

  return (
    <nav
      aria-label="Pagination Navigation"
      className="flex flex-col md:flex-row items-center justify-between gap-3.5 py-3.5 px-4 sm:px-6 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-[#000000]/40 text-xs text-slate-600 dark:text-slate-400 transition-colors duration-200"
    >
      <div className="flex items-center gap-2">
        <span>
          Showing <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-900 dark:text-white tabular-nums">{total.toLocaleString('en-IN')}</span>{' '}
          records
        </span>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
          {/* First Page */}
          <button
            type="button"
            onClick={() => handlePageClick(1)}
            disabled={disabled || page <= 1}
            aria-label="Go to first page"
            title="First page"
            className={navButtonClass}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">First</span>
          </button>

          {/* Previous Page */}
          <button
            type="button"
            onClick={() => handlePageClick(page - 1)}
            disabled={disabled || page <= 1}
            aria-label="Go to previous page"
            title="Previous page"
            className={navButtonClass}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          {/* Desktop Numeric Pages */}
          <div className="hidden sm:flex items-center gap-1">
            {pages.map((item, index) => {
              if (item === 'ellipsis') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="w-8 h-8 flex items-center justify-center text-slate-400 dark:text-slate-500 text-xs select-none"
                    aria-hidden="true"
                  >
                    …
                  </span>
                );
              }

              const isCurrent = item === page;
              return (
                <button
                  key={item}
                  type="button"
                  disabled={disabled}
                  onClick={() => handlePageClick(item)}
                  aria-current={isCurrent ? 'page' : undefined}
                  aria-label={`Go to page ${item}`}
                  className={`min-w-8 h-8 px-2 rounded-lg text-xs font-semibold flex items-center justify-center transition cursor-pointer select-none ${
                    isCurrent
                      ? 'bg-brand-600 text-white dark:bg-brand-500 shadow-sm font-bold'
                      : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {/* Mobile Current Indicator */}
          <span
            aria-current="page"
            className="sm:hidden px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 font-semibold text-xs border border-brand-200 dark:border-brand-500/30 tabular-nums whitespace-nowrap"
          >
            Page {page} of {totalPages}
          </span>

          {/* Next Page */}
          <button
            type="button"
            onClick={() => handlePageClick(page + 1)}
            disabled={disabled || page >= totalPages}
            aria-label="Go to next page"
            title="Next page"
            className={navButtonClass}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Last Page */}
          <button
            type="button"
            onClick={() => handlePageClick(totalPages)}
            disabled={disabled || page >= totalPages}
            aria-label="Go to last page"
            title="Last page"
            className={navButtonClass}
          >
            <span className="hidden xl:inline">Last</span>
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>

          {/* Optional Quick Jump for when totalPages >= 6 */}
          {totalPages >= 6 && (
            <form onSubmit={handleJumpSubmit} className="hidden lg:flex items-center gap-1.5 ml-1 pl-2 border-l border-slate-200 dark:border-slate-700">
              <span className="text-[11px] text-slate-500">Go to:</span>
              <input
                type="number"
                min={1}
                max={totalPages}
                value={jumpPage}
                onChange={(e) => setJumpPage(e.target.value)}
                placeholder={`${page}`}
                aria-label="Jump to page"
                className="w-12 h-7 px-1.5 text-center text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:border-brand-500 tabular-nums"
              />
              <button
                type="submit"
                disabled={disabled || !jumpPage}
                className="px-2 h-7 rounded-md bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-[11px] font-medium text-slate-700 dark:text-slate-300 disabled:opacity-40 transition"
              >
                Go
              </button>
            </form>
          )}
        </div>
      )}
    </nav>
  );
};
