import React from 'react';
import { AlertCircle, Inbox, LucideIcon } from 'lucide-react';
import { Spinner } from './ui';

interface TableStateRowProps {
  colSpan: number;
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  loadingText: string;
  emptyText: string;
  emptyTitle?: string;
  emptyIcon?: LucideIcon;
  // Next step for an empty list, e.g. a "Create plan" or "Clear filters" button
  emptyAction?: React.ReactNode;
  errorText?: string;
  onRetry?: () => void;
}

// Renders the loading / error / empty row of a table. Returns null when there are rows to show.
export const TableStateRow: React.FC<TableStateRowProps> = ({
  colSpan,
  isLoading,
  isError,
  isEmpty,
  loadingText,
  emptyText,
  emptyTitle = 'Nothing to show',
  emptyIcon: EmptyIcon = Inbox,
  emptyAction,
  errorText = 'Failed to load records. Please try again.',
  onRetry,
}) => {
  if (isLoading) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-12 text-slate-400 text-xs">
          <Spinner className="w-6 h-6 mx-auto mb-2" />
          {loadingText}
        </td>
      </tr>
    );
  }

  if (isError) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-12 text-rose-600 dark:text-rose-400 text-xs" role="alert">
          <AlertCircle className="w-6 h-6 mx-auto mb-2" />
          <p className="font-semibold">{errorText}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition"
            >
              Retry
            </button>
          )}
        </td>
      </tr>
    );
  }

  if (isEmpty) {
    return (
      <tr>
        <td colSpan={colSpan} className="text-center py-12 px-4">
          <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3">
            <EmptyIcon className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </div>
          <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{emptyTitle}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">{emptyText}</p>
          {emptyAction && <div className="mt-4 flex justify-center">{emptyAction}</div>}
        </td>
      </tr>
    );
  }

  return null;
};
