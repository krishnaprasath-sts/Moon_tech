"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, BadgeCheck, CandlestickChart, GraduationCap, Headset, MonitorPlay, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/lib/useAuth';

const HIGHLIGHTS = [
  { icon: GraduationCap, label: 'For complete beginners' },
  { icon: MonitorPlay, label: 'Live online classes' },
  { icon: Headset, label: 'Personal mentor' },
  { icon: ShieldCheck, label: 'Learn to avoid big losses' },
];

const OUTCOMES = [
  { title: 'Understand the market', desc: 'Learn what shares are and how buying and selling works.' },
  { title: 'Read stock charts', desc: 'Know when a price is going up or down, in simple steps.' },
  { title: 'Trade safely', desc: 'Plan before you buy and protect your money from big losses.' },
];

export const HeroSection: React.FC = () => {
  const { token } = useAuth({ required: false });
  const isAuthenticated = Boolean(token);

  return (
    <section className="relative overflow-hidden pt-16 pb-16 md:pt-24 md:pb-20">
      {/* Subtle ambient lighting */}
      <div className="ambient-glow absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center max-w-3xl mx-auto space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/25 text-blue-700 dark:text-blue-400 text-[11px] font-semibold">
            <BadgeCheck className="w-3.5 h-3.5" />
            <span>Clyvus Ventures · Stock market &amp; trading training</span>
          </div>

          <h1 className="text-4xl sm:text-6xl font-extrabold text-zinc-950 dark:text-white tracking-tight leading-[1.08]">
            Learn the stock market <br className="hidden sm:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 dark:from-blue-400 dark:via-indigo-300 dark:to-cyan-300">
              the simple way.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            New to shares? We teach you step by step, in easy language. Join live online classes, ask your mentor
            anything, and learn how to buy and sell shares safely.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href={isAuthenticated ? '/dashboard' : '/register'}
              className="group/cta inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-zinc-950 hover:bg-zinc-800 text-white dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 text-sm font-semibold transition active:scale-95 shadow-sm"
            >
              <span>{isAuthenticated ? 'Go to dashboard' : 'Start free'}</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/cta:translate-x-1" />
            </Link>
            <a
              href="#programs"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-white dark:bg-zinc-900/60 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300 text-sm font-medium border border-zinc-200 dark:border-white/[0.08] transition shadow-xs"
            >
              <CandlestickChart className="w-3.5 h-3.5" />
              See the courses
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

        {/* What you walk away with */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {OUTCOMES.map((item, index) => (
            <div
              key={item.title}
              className="p-5 rounded-2xl bg-white/80 dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/[0.07] shadow-xs backdrop-blur-sm text-left"
            >
              <span className="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400">0{index + 1}</span>
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-white mt-1.5">{item.title}</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mt-1">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
