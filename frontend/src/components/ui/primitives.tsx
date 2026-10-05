"use client";

import React, { useEffect, useId, useRef } from 'react';
import { AlertCircle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, RefreshCw, X } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { humanize } from '@/lib/format';
import type { PageMeta } from '@/lib/api';

// ---------------------------------------------------------------------------
// Shared class names (match the existing login / dashboard styling)
// ---------------------------------------------------------------------------
export const inputClass =
  'w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 aria-invalid:border-rose-500/60 transition disabled:opacity-60';

export const labelClass = 'block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5';

export const helpTextClass = 'text-[11px] text-zinc-500 mt-1.5 leading-relaxed';

export const fieldErrorClass = 'text-[11px] text-rose-600 dark:text-rose-400 mt-1.5';

export const primaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 text-xs font-semibold transition active:scale-98 shadow-xs';

export const secondaryButtonClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 disabled:opacity-50 text-xs font-semibold transition';

export const accentButtonClass =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 text-xs font-semibold transition active:scale-98 shadow-xs';

export const cardClass =
  'rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200/90 dark:border-white/[0.08] shadow-xs';

/** Pill used for filter tabs / chips. */
export function chipClass(selected: boolean): string {
  return `px-3 py-1.5 rounded-full text-xs font-medium transition flex-shrink-0 ${
    selected
      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs font-semibold'
      : 'bg-zinc-100 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06]'
  }`;
}

/** Required-field marker for labels. */
export function RequiredMark() {
  return (
    <span className="text-rose-500 font-bold" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

export function Spinner({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return <Loader2 className={`${className} animate-spin`} aria-hidden="true" />;
}

// ---------------------------------------------------------------------------
// Page shell
// ---------------------------------------------------------------------------
export function PageShell({ children, width = 'max-w-6xl' }: { children: React.ReactNode; width?: string }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between transition-colors duration-200">
      <Navbar />
      <main className={`flex-1 ${width} mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full space-y-7 min-w-0`}>{children}</main>
      <Footer />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/[0.06]">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-zinc-950 dark:text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Header strip used at the top of list / table cards. */
export function CardHeader({
  icon,
  title,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-4 px-5 border-b border-zinc-100 dark:border-white/[0.06] flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-zinc-500 dark:text-zinc-400 shrink-0 [&>svg]:w-3.5 [&>svg]:h-3.5">{icon}</span>}
        <h2 className="text-xs font-semibold text-zinc-900 dark:text-white uppercase tracking-wider truncate">{title}</h2>
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function FullPageMessage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-zinc-500 flex items-center justify-center text-xs" aria-busy="true">
      <Spinner className="w-4 h-4 mr-2" />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------
type AlertTone = 'error' | 'success' | 'info' | 'warning';

const ALERT_TONES: Record<AlertTone, string> = {
  error: 'bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400',
  success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400',
  info: 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300',
  warning: 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400',
};

export function Alert({
  tone = 'error',
  children,
  className = '',
  action,
}: {
  tone?: AlertTone;
  children: React.ReactNode;
  className?: string;
  /** Optional trailing action (link or button). */
  action?: React.ReactNode;
}) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'info' ? Info : AlertCircle;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${ALERT_TONES[tone]} ${className}`}
    >
      <Icon className="w-4 h-4 shrink-0 mt-px" />
      <div className="leading-relaxed min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-10 text-center space-y-3" role="alert">
      <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
        <AlertCircle className="w-4 h-4" />
      </div>
      <p className="text-xs text-rose-700 dark:text-rose-400 max-w-sm mx-auto">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={secondaryButtonClass}>
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Try again</span>
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-12 text-center space-y-3">
      {icon && (
        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-white/[0.04] flex items-center justify-center text-zinc-400 mx-auto">
          {icon}
        </div>
      )}
      <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{title}</div>
      {description && <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">{description}</p>}
      {action && <div className="pt-1 flex justify-center">{action}</div>}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="p-5 space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="h-9 rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------
const BADGE_GREEN = 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20';
const BADGE_AMBER = 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20';
const BADGE_ROSE = 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20';
const BADGE_BLUE = 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20';
const BADGE_ZINC = 'bg-zinc-500/10 text-zinc-700 dark:text-zinc-400 border-zinc-500/20';

const BADGE_STYLES: Record<string, string> = {
  ACTIVE: BADGE_BLUE,
  MATURED: BADGE_GREEN,
  WITHDRAWAL_REQUESTED: BADGE_AMBER,
  COMPLETED: BADGE_GREEN,
  CANCELLED: BADGE_ZINC,
  PENDING: BADGE_AMBER,
  UNDER_REVIEW: BADGE_AMBER,
  APPROVED: BADGE_BLUE,
  REJECTED: BADGE_ROSE,
  RESUBMISSION_REQUIRED: BADGE_ROSE,
  VERIFIED: BADGE_GREEN,
  FAILED: BADGE_ROSE,
  SUSPENDED: BADGE_ROSE,
  BLOCKED: BADGE_ROSE,
  INACTIVE: BADGE_ZINC,
  DRAFT: BADGE_ZINC,
  NOT_AVAILABLE: BADGE_ZINC,
};

export type BadgeKind = 'deposit' | 'investment' | 'withdrawal' | 'transaction' | 'kyc';

/** Per-domain overrides: the same status word can mean different things. */
const KIND_STYLES: Partial<Record<BadgeKind, Record<string, string>>> = {
  // An approved deposit is final: the wallet has been credited.
  deposit: { APPROVED: BADGE_GREEN },
  // An approved withdrawal is still waiting for the payout to be made.
  withdrawal: { APPROVED: BADGE_BLUE },
};

const KIND_LABELS: Partial<Record<BadgeKind, Record<string, string>>> = {
  deposit: { PENDING: 'Pending verification', APPROVED: 'Approved', REJECTED: 'Rejected' },
  withdrawal: { PENDING: 'Requested', APPROVED: 'Approved', COMPLETED: 'Paid', REJECTED: 'Rejected' },
  investment: { WITHDRAWAL_REQUESTED: 'Withdrawal requested' },
  kyc: { DRAFT: 'Not submitted', PENDING: 'Under review', UNDER_REVIEW: 'Under review', RESUBMISSION_REQUIRED: 'Resubmission required' },
};

export function StatusBadge({ status, label, kind }: { status: string; label?: string; kind?: BadgeKind }) {
  const style = (kind && KIND_STYLES[kind]?.[status]) || BADGE_STYLES[status] || BADGE_ZINC;
  const text = label || (kind && KIND_LABELS[kind]?.[status]) || humanize(status);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${style}`}>
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------
export function Pagination({
  meta,
  onPageChange,
  disabled = false,
}: {
  meta: PageMeta;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  if (meta.total === 0) return null;
  const first = (meta.page - 1) * meta.limit + 1;
  const last = Math.min(meta.page * meta.limit, meta.total);
  const buttonClass =
    'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 transition font-medium';

  return (
    <nav
      aria-label="Pagination"
      className="px-5 py-3 border-t border-zinc-100 dark:border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500"
    >
      <span>
        Showing {first}–{last} of {meta.total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || meta.page <= 1}
          onClick={() => onPageChange(meta.page - 1)}
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          <span>Previous</span>
        </button>
        <span className="font-mono" aria-current="page">
          {meta.page} / {meta.totalPages}
        </span>
        <button
          type="button"
          className={buttonClass}
          disabled={disabled || meta.page >= meta.totalPages}
          onClick={() => onPageChange(meta.page + 1)}
        >
          <span>Next</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------
/**
 * Locks body scroll, closes on Escape and on backdrop click (unless
 * `closeDisabled`), moves focus into the dialog and restores it on close.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
  width = 'max-w-md',
  closeDisabled = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  /** Prevents closing while a submission is in flight. */
  closeDisabled?: boolean;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose, closeDisabled]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto"
      onClick={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${width} rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 p-6 shadow-2xl relative my-auto max-h-[92vh] overflow-y-auto focus:outline-none`}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
          aria-label="Close"
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 rounded-lg disabled:opacity-40"
        >
          <X className="w-4 h-4" />
        </button>
        <h3 id={titleId} className="text-base font-bold text-zinc-950 dark:text-white mb-1 pr-8">
          {title}
        </h3>
        {description && <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-5 leading-relaxed">{description}</p>}
        {!description && <div className="mb-4" />}
        {children}
      </div>
    </div>
  );
}

export function DetailRow({
  label,
  value,
  strong = false,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  strong?: boolean;
  tone?: 'default' | 'profit';
}) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5">
      <span className="text-zinc-500 dark:text-zinc-400 shrink-0">{label}</span>
      <span
        className={`text-right break-all ${strong ? 'font-bold' : 'font-medium'} ${
          tone === 'profit' ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-900 dark:text-zinc-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
