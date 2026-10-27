import React from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, CandlestickChart, Layers, Users } from 'lucide-react';

const PROGRAMS = [
  {
    icon: BookOpen,
    level: 'Beginner',
    title: 'Stock Market Basics',
    desc: 'Start from zero. Learn what a share is, how to open a demat account and how to buy and sell shares.',
    topics: ['What is a share', 'Demat account', 'Buying & selling', 'Nifty & Sensex'],
  },
  {
    icon: CandlestickChart,
    level: 'Intermediate',
    title: 'Chart Reading',
    desc: 'Learn to read stock charts. See if a price is rising or falling and decide when to buy and when to sell.',
    topics: ['Price charts', 'Up & down trends', 'When to buy', 'When to sell'],
  },
  {
    icon: Layers,
    level: 'Advanced',
    title: 'Futures & Options',
    desc: 'Futures and options (F&O) explained in simple words, with examples. Learn how they work and the risks.',
    topics: ['What is F&O', 'Simple examples', 'Common strategies', 'Risks'],
  },
  {
    icon: Users,
    level: 'Mentorship',
    title: 'Live Trading with a Mentor',
    desc: 'Practise in the real market with a mentor guiding you. Plan each trade, learn from mistakes and stay calm.',
    topics: ['Live market', 'Trade planning', 'Learn from mistakes', 'Control emotions'],
  },
];

export const ProgramsSection: React.FC = () => {
  return (
    <section id="programs" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
      <div data-reveal className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-10 pb-4 border-b border-zinc-200 dark:border-white/[0.06]">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight mb-1">
            Our courses
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm">
            Four courses. Start with the basics, or pick the one you need.
          </p>
        </div>
        <Link
          href="/register"
          className="group/cta inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Join a course <ArrowRight className="w-3 h-3 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover/cta:translate-x-1" />
        </Link>
      </div>

      <div data-reveal-group className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {PROGRAMS.map((program) => {
          const Icon = program.icon;
          return (
            <article
              data-reveal
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
        Classes are held in the evenings and on weekends. You can see dates, timings and fees after you sign up.
      </p>
    </section>
  );
};
