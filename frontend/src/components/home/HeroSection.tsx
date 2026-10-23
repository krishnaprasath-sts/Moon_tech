"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, GraduationCap, Headset, MonitorPlay } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';

const HIGHLIGHTS = [
  { icon: GraduationCap, label: 'Beginner to advanced' },
  { icon: MonitorPlay, label: 'Live market sessions' },
  { icon: Headset, label: 'Mentor support' },
];

export const HeroSection: React.FC = () => {
  const { token } = useAuth({ required: false });
  const isAuthenticated = Boolean(token);

  return (
    <section className="relative overflow-hidden pt-16 pb-16 md:pt-24 md:pb-24">
      {/* Subtle ambient lighting */}
      <div className="ambient-glow absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 text-blue-700 dark:text-blue-400 text-[11px] font-semibold">
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>Stock market &amp; trading training</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-zinc-950 dark:text-white tracking-tight leading-[1.08]">
            Learn to trade the stock market <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-300">
              with confidence.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            MoonTech Solutions trains beginners and working professionals in how the Indian stock market works,
            technical analysis and disciplined trading, through structured programs, live market sessions and
            one-to-one mentor support.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={isAuthenticated ? '/dashboard' : '/register'}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold transition active:scale-95 shadow-sm"
            >
              <span>{isAuthenticated ? 'Go to dashboard' : 'Create your account'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <a
              href="#programs"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 text-sm font-medium border border-zinc-200 dark:border-white/[0.08] transition shadow-xs"
            >
              Explore programs
            </a>
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-4 text-xs text-zinc-600 dark:text-zinc-400">
            {HIGHLIGHTS.map((item) => (
              <li key={item.label} className="inline-flex items-center gap-1.5">
                <item.icon className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
