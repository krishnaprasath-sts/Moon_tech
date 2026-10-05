import React from 'react';
import { AlertTriangle, RotateCw, Home } from 'lucide-react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  // When this value changes (e.g. the route), the boundary resets and renders its children again
  resetKey?: string;
  // Full-screen variant for the application root
  fullScreen?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

// Catches render errors so a bug in one page shows a friendly card instead of a blank screen.
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.assign('/dashboard');
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const card = (
      <div
        role="alert"
        className="w-full max-w-md mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center shadow-xl"
      >
        <div className="inline-flex p-3 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Something went wrong</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
          An unexpected error stopped this screen from rendering. Your data is safe. Reload the page to continue,
          and contact support if it keeps happening.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <button
            type="button"
            onClick={this.handleReload}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-blue-600 hover:from-brand-500 hover:to-blue-600 text-white text-xs font-bold shadow-lg shadow-brand-500/20 transition"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Reload page
          </button>
          <button
            type="button"
            onClick={this.handleGoHome}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
          >
            <Home className="w-3.5 h-3.5" />
            Go to dashboard
          </button>
        </div>
      </div>
    );

    if (this.props.fullScreen) {
      return (
        <div className="min-h-screen bg-slate-50 dark:bg-[#000000] flex items-center justify-center p-4">{card}</div>
      );
    }

    return <div className="py-12 px-4">{card}</div>;
  }
}
