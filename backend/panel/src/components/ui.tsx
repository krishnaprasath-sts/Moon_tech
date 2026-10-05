import React from 'react';
import { AlertCircle, Lock } from 'lucide-react';

// Shared form / button / table styles so every page and modal looks the same

export const inputClass =
  'w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-not-allowed transition';

export const inputSmClass =
  'w-full bg-slate-50 dark:bg-[#000000] border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-not-allowed transition';

export const textareaClass =
  'w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 disabled:opacity-60 disabled:cursor-not-allowed transition';

export const selectClass =
  'bg-slate-50 dark:bg-[#000000] border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-300 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition';

export const labelClass = 'block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5';

export const btnPrimaryClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-500 hover:to-blue-600 text-white rounded-xl text-xs font-semibold shadow-lg shadow-brand-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed';

export const btnSecondaryClass =
  'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl text-xs font-semibold border border-slate-200 dark:border-slate-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed';

export const btnGhostClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed';

export const btnSuccessClass =
  'inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed';

export const btnDangerClass =
  'inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-rose-600/25 transition disabled:opacity-50 disabled:cursor-not-allowed';

export const btnDangerOutlineClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-600 hover:text-white dark:hover:bg-rose-600 dark:hover:text-white border border-rose-200 dark:border-rose-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed';

// Small table row action button (e.g. "View receipt", "Manage")
export const btnRowClass =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed';

export const tableCardClass =
  'bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl transition-colors duration-200';

export const filterCardClass =
  'bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm dark:shadow-lg transition-colors duration-200';

export const cardClass =
  'bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm dark:shadow-lg transition-colors duration-200';

export const theadClass =
  'bg-slate-50/80 dark:bg-[#000000]/80 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider';

export const tbodyClass = 'divide-y divide-slate-100 dark:divide-slate-800/60';

// Zebra + hover rows
export const trClass =
  'even:bg-slate-50/50 dark:even:bg-slate-900/30 hover:bg-slate-100/70 dark:hover:bg-slate-800/40 transition duration-150';

// Numbers and money are right-aligned in a tabular monospace font
export const numCellClass = 'text-right font-mono tabular-nums whitespace-nowrap';

export const RequiredMark: React.FC = () => (
  <span className="text-rose-500" aria-hidden="true">
    {' '}
    *
  </span>
);

export const OptionalMark: React.FC = () => <span className="text-slate-400 font-medium"> (Optional)</span>;

interface FieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  optional?: boolean;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}

// Label + control + hint/error, with the label linked to the control for screen readers
export const Field: React.FC<FieldProps> = ({
  label,
  htmlFor,
  required,
  optional,
  hint,
  error,
  className = '',
  children,
}) => (
  <div className={className}>
    <label htmlFor={htmlFor} className={labelClass}>
      {label}
      {required && <RequiredMark />}
      {optional && <OptionalMark />}
    </label>
    {children}
    {error ? (
      <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1" role="alert">
        {error}
      </p>
    ) : hint ? (
      <p className="text-[10px] text-slate-400 mt-1">{hint}</p>
    ) : null}
  </div>
);

export const FormError: React.FC<{ message?: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400"
    >
      <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
      <span>{message}</span>
    </div>
  );
};

// Shown to EDITOR staff wherever managers would see action buttons
export const ViewOnlyNote: React.FC<{ text?: string; className?: string }> = ({
  text = 'View only',
  className = '',
}) => (
  <span
    title="Your role can view this data but cannot change it"
    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 ${className}`}
  >
    <Lock className="w-3 h-3 text-slate-400" />
    {text}
  </span>
);

export const Spinner: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <div
    role="status"
    aria-label="Loading"
    className={`animate-spin border-2 border-brand-500 border-t-transparent rounded-full ${className}`}
  />
);

// Inline error card with a retry button, used for non-table content (cards, detail views)
export const ErrorState: React.FC<{ message: string; onRetry?: () => void; className?: string }> = ({
  message,
  onRetry,
  className = '',
}) => (
  <div role="alert" className={`py-10 text-center text-xs text-rose-600 dark:text-rose-400 ${className}`}>
    <AlertCircle className="w-6 h-6 mx-auto mb-2" />
    <p className="font-semibold">{message}</p>
    {onRetry && (
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold transition"
      >
        Retry
      </button>
    )}
  </div>
);
