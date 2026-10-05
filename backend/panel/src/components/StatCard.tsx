import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  colorClass?: string;
  iconBgClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  colorClass = 'text-slate-900 dark:text-white',
  iconBgClass = 'bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20',
}) => {
  const display = typeof value === 'number' ? value.toLocaleString('en-IN') : value;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800/80 p-5 shadow-sm dark:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 transition duration-200 group h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
          <p className={`text-2xl font-bold mt-1 tracking-tight tabular-nums break-words ${colorClass}`}>{display}</p>
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 transition transform group-hover:scale-110 ${iconBgClass}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {subtitle && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 truncate" title={subtitle}>
          {subtitle}
        </p>
      )}
    </div>
  );
};
