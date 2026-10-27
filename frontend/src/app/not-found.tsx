import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Compass } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

export const metadata: Metadata = {
  title: 'Page not found | Clyvus Ventures',
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full flex items-center justify-center">
        <div className="w-full max-w-md p-7 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200/90 dark:border-white/[0.08] shadow-xs text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">404</p>
            <h1 className="text-xl font-bold text-zinc-950 dark:text-white tracking-tight mt-1">Page not found</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
              The page you are looking for does not exist or has moved. Use the links below to get back on track.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
            <Link
              href="/dashboard"
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 text-xs font-semibold transition"
            >
              <span>Go to dashboard</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
            <Link
              href="/plans"
              className="w-full sm:flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition"
            >
              View plans
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
