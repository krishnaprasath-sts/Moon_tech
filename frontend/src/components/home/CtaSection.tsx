"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';

export const CtaSection: React.FC = () => {
  const { token } = useAuth({ required: false });
  const isAuthenticated = Boolean(token);

  return (
    <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div data-reveal className="relative overflow-hidden rounded-3xl bg-zinc-950 dark:bg-white/[0.04] border border-zinc-800 dark:border-white/[0.08] px-6 py-12 sm:px-12 text-center text-white">
        <div className="absolute -top-20 -left-10 w-64 h-64 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-10 w-64 h-64 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-2xl mx-auto space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Ready to start learning?</h2>
          <p className="text-sm text-zinc-300 leading-relaxed">
            Create your free account in one minute. No experience needed.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={isAuthenticated ? '/dashboard' : '/register'}
              className="group/cta inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white text-zinc-950 hover:bg-zinc-200 text-sm font-semibold transition active:scale-95"
            >
              <span>{isAuthenticated ? 'Go to dashboard' : 'Create my account'}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/cta:translate-x-1" />
            </Link>
            {!isAuthenticated && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full border border-white/20 hover:bg-white/10 text-sm font-medium transition"
              >
                I already have an account
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
