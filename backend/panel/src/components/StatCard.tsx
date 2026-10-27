import React from 'react';
import { LucideIcon } from 'lucide-react';
import { CountUp } from './CountUp';

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
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800/80 p-5 shadow-sm dark:shadow-lg hover:border-slate-300 dark:hover:border-slate-700 hover:-translate-y-0.5 hover:shadow-md transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group h-full">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
          <p className={`text-2xl font-bold mt-1 tracking-tight tabular-nums break-words ${colorClass}`}><CountUp value={value} /></p>
        </div>
        <div className={`p-3 rounded-xl flex-shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:scale-110 group-hover:-rotate-6 ${iconBgClass}`}>
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
