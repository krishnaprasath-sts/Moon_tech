import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CandlestickChart, Layers, Users } from 'lucide-react';

const PROGRAMS = [
  {
    icon: BookOpen,
    level: 'Beginner',
    title: 'Stock Market Foundations',
    desc: 'How the Indian stock market works: NSE and BSE, demat and trading accounts, order types, indices, reading a quote and the basics of risk.',
    topics: ['Market structure', 'Demat & orders', 'Indices & sectors', 'Risk basics'],
  },
  {
    icon: CandlestickChart,
    level: 'Intermediate',
    title: 'Technical Analysis',
    desc: 'Read charts with confidence: candlesticks, support and resistance, trends, moving averages, RSI and MACD, chart patterns, entries and exits.',
    topics: ['Candlesticks', 'Trends & levels', 'Indicators', 'Entries & exits'],
  },
  {
    icon: Layers,
    level: 'Advanced',
    title: 'Options & Derivatives',
    desc: 'Futures and options explained in plain language: how contracts work, the Greeks, hedging, popular option strategies, margin and position risk.',
    topics: ['Futures & options', 'Greeks simplified', 'Strategies', 'Hedging & margin'],
  },
  {
    icon: Users,
    level: 'Mentorship',
    title: 'Live Trading Mentorship',
    desc: 'Trade the live market with a mentor beside you: market-open sessions, trade planning, journaling and review, position sizing and trading psychology.',
    topics: ['Market-open sessions', 'Trade planning', 'Journal review', 'Psychology'],
  },
];

export const ProgramsSection: React.FC = () => {
  return (
    <section id="programs" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-10 pb-4 border-b border-zinc-200 dark:border-white/[0.06]">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight mb-1">
            Training programs
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm">
            Four tracks that take you from your first demat account to trading the live market with a plan.
          </p>
        </div>
        <Link
          href="/register"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Join a program <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PROGRAMS.map((program) => {
          const Icon = program.icon;
          return (
            <article
              key={program.title}
              className="group p-6 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.07] hover:border-blue-500/30 dark:hover:border-blue-400/30 hover:-translate-y-1 hover:shadow-xl shadow-xs transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-600/20 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-md bg-zinc-100 dark:bg-white/[0.05] text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.08]">
                  {program.level}
                </span>
              </div>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-white mt-4 mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                {program.title}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{program.desc}</p>
              <ul className="flex flex-wrap gap-1.5 mt-4">
                {program.topics.map((topic) => (
                  <li
                    key={topic}
                    className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-zinc-600 dark:text-zinc-400"
                  >
                    {topic}
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <p className="text-[11px] text-zinc-500 mt-6 leading-relaxed">
        Batch dates, timings and fees are shared with you after you create an account. Programs can be taken one after
        the other or picked individually.
      </p>
    </section>
  );
};
