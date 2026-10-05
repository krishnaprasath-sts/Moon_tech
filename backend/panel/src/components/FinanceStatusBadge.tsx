import React from 'react';
import { humanize } from '../utils/finance';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  APPROVED: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  REJECTED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  COMPLETED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  ACTIVE: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  MATURED: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  WITHDRAWAL_REQUESTED: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
};

const FALLBACK_STYLE =
  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';

export const FinanceStatusBadge: React.FC<{ status?: string | null }> = ({ status }) => {
  const key = (status || '').toUpperCase();

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${
        STATUS_STYLES[key] || FALLBACK_STYLE
      }`}
    >
      {humanize(key) || 'Unknown'}
    </span>
  );
};
