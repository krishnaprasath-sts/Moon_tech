import React from 'react';
import { UserStatus } from '../types';
import { humanize } from '../utils/finance';

const CONFIG: Record<string, { label: string; className: string }> = {
  [UserStatus.ACTIVE]: {
    label: 'Active',
    className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  },
  [UserStatus.SUSPENDED]: {
    label: 'Suspended',
    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
  },
  [UserStatus.PENDING_VERIFICATION]: {
    label: 'Pending Verification',
    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  },
  [UserStatus.INACTIVE]: {
    label: 'Inactive',
    className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  },
};

export const AccountStatusBadge: React.FC<{ status: UserStatus | string; className?: string }> = ({
  status,
  className = '',
}) => {
  const config = CONFIG[status] || {
    label: humanize(status) || 'Unknown',
    className: CONFIG[UserStatus.INACTIVE].className,
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${config.className} ${className}`}
    >
      {config.label}
    </span>
  );
};
