"use client";

import Link from 'next/link';
import { AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';

/**
 * Route-level error boundary. Kept deliberately small (no Navbar or data
 * fetching) so it cannot fail for the same reason as the page it replaces.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col items-center p-4 py-8 sm:py-12">
      <div className="w-full max-w-5xl flex items-center px-2 sm:px-4 mb-4">
        <Logo size="sm" />
      </div>

      <div className="w-full max-w-md my-auto">
        <div className="p-7 rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200/90 dark:border-white/[0.08] shadow-xl text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight">Something went wrong</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              An unexpected error occurred while showing this page. Your wallet, plans and requests are not
              affected. Please try again, and if the problem continues, sign out and back in.
            </p>
          </div>

          {error.digest && (
            <p className="text-[11px] text-zinc-500 font-mono">
              Error reference: <span className="text-zinc-700 dark:text-zinc-300">{error.digest}</span>
            </p>
          )}

          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => retry()}
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Try again</span>
            </button>
            <Link
              href="/dashboard"
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition"
            >
              <span>Go to dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-800 dark:hover:text-zinc-300 transition">
          ← Back to Clyvus Ventures Home
        </Link>
      </div>
    </div>
  );
}
