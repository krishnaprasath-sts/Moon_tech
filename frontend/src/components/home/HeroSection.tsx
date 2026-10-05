"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const HeroSection: React.FC = () => {
  return (
    <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
      {/* Subtle Ambient Radial Lighting */}
      <div className="ambient-glow absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Main Centered Minimalist Typography */}
        <div className="text-center max-w-3xl mx-auto space-y-6">
          
          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-extrabold text-zinc-950 dark:text-white tracking-tight leading-[1.08]">
            Stock market investing, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-300">
              simple & transparent.
            </span>
          </h1>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed font-normal">
            Add money to your wallet by UPI, choose a stock market investment plan, and see the expected profit and maturity amount before you confirm. Withdraw to your bank account or UPI once your investment matures.
          </p>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-500 max-w-xl mx-auto leading-relaxed">
            Investments carry risk. Profit figures are expected amounts as per each plan&apos;s terms and are not guaranteed.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold transition active:scale-95 shadow-sm"
            >
              <span>Get Started</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>

            <Link
              href="/plans"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 text-sm font-medium border border-zinc-200 dark:border-white/[0.08] transition shadow-xs"
            >
              <span>View Plans</span>
            </Link>
          </div>

        </div>

      </div>
    </section>
  );
};
