import React from 'react';
import { ViewOnlyNote } from './ui';

interface PageHeaderProps {
  title: string;
  description?: string;
  // Primary and secondary actions, rendered on the right
  actions?: React.ReactNode;
  // Shows the "view only" note for EDITOR staff next to (or instead of) action buttons
  viewOnly?: boolean;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, description, actions, viewOnly }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
    <div className="min-w-0">
      <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">{title}</h1>
      {description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 max-w-2xl">{description}</p>}
    </div>

    {(actions || viewOnly) && (
      <div className="flex flex-wrap items-center gap-2.5 flex-shrink-0">
        {viewOnly && <ViewOnlyNote />}
        {actions}
      </div>
    )}
  </div>
);
