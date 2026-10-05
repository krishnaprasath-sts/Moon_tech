import React from 'react';
import { KycStatus } from '../types';
import { CheckCircle2, Clock, XCircle, RotateCcw, AlertCircle, FileEdit, ShieldAlert, LucideIcon } from 'lucide-react';

interface KycStatusBadgeProps {
  status: KycStatus | string;
  className?: string;
  showIcon?: boolean;
}

const CONFIG: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  [KycStatus.VERIFIED]: {
    label: 'Verified',
    icon: CheckCircle2,
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  [KycStatus.PENDING]: {
    label: 'Pending Review',
    icon: Clock,
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  [KycStatus.UNDER_REVIEW]: {
    label: 'Under Review',
    icon: AlertCircle,
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  },
  [KycStatus.REJECTED]: {
    label: 'Rejected',
    icon: XCircle,
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  [KycStatus.RESUBMISSION_REQUIRED]: {
    label: 'Resubmission Required',
    icon: RotateCcw,
    className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
  },
  [KycStatus.SUSPENDED]: {
    label: 'Suspended',
    icon: ShieldAlert,
    className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/40',
  },
  [KycStatus.DRAFT]: {
    label: 'Not Submitted',
    icon: FileEdit,
    className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  },
};

export const KycStatusBadge: React.FC<KycStatusBadgeProps> = ({ status, className = '', showIcon = true }) => {
  const config = CONFIG[status] || CONFIG[KycStatus.DRAFT];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border whitespace-nowrap ${config.className} ${className}`}
    >
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {config.label}
    </span>
  );
};
