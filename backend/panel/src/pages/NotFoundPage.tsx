import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Compass, LayoutDashboard, ArrowLeft } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const location = useLocation();

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm dark:shadow-xl">
        <div className="inline-flex p-3 rounded-2xl bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 mb-4">
          <Compass className="w-7 h-7" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Error 404</p>
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">Page not found</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed break-all">
          There is no admin page at{' '}
          <span className="font-mono text-slate-700 dark:text-slate-300">{location.pathname}</span>. It may have
          moved or the link may be incorrect.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link
            to="/dashboard"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-500 hover:to-blue-600 text-white text-xs font-bold shadow-lg shadow-brand-500/20 transition"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Go to dashboard
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Go back
          </button>
        </div>
      </div>
    </div>
  );
};
