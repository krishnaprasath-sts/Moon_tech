import React from 'react';

export interface StatusTab {
  id: string;
  label: string;
  count?: number;
}

interface StatusTabsProps {
  tabs: StatusTab[];
  activeTab: string;
  onChange: (id: string) => void;
  label?: string;
}

export const StatusTabs: React.FC<StatusTabsProps> = ({ tabs, activeTab, onChange, label = 'Filter by status' }) => {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800/80 pb-2"
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-semibold transition ${
              isActive
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-500/20'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold tabular-nums ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                {tab.count.toLocaleString('en-IN')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
