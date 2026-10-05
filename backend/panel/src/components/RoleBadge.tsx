import React from 'react';
import { UserRole } from '../types';
import { ShieldCheck, Shield, Eye, User, LucideIcon } from 'lucide-react';

const CONFIG: Record<string, { label: string; icon: LucideIcon; className: string }> = {
  [UserRole.SUPER_ADMIN]: {
    label: 'Super Admin',
    icon: ShieldCheck,
    className: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30',
  },
  [UserRole.ADMIN]: {
    label: 'Admin',
    icon: Shield,
    className: 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border-brand-500/30',
  },
  [UserRole.EDITOR]: {
    label: 'Editor',
    icon: Eye,
    className: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  },
  [UserRole.CUSTOMER]: {
    label: 'Customer',
    icon: User,
    className: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  },
};

export const RoleBadge: React.FC<{ role: UserRole | string; className?: string }> = ({ role, className = '' }) => {
  const config = CONFIG[role] || CONFIG[UserRole.CUSTOMER];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${config.className} ${className}`}
    >
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
};
