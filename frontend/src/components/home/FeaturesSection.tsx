import React from 'react';
import { BookOpen, Brain, Headset, MonitorPlay, NotebookPen, ShieldCheck } from 'lucide-react';

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Structured curriculum',
    desc: 'Each program follows a clear path, from the basics to advanced concepts, so nothing important is skipped.',
  },
  {
    icon: MonitorPlay,
    title: 'Live market sessions',
    desc: 'Learn on real charts while the market is open, not only from slides. See how setups form and play out.',
  },
  {
    icon: Headset,
    title: 'Mentor support',
    desc: 'Ask questions, get your trade plans reviewed and clear doubts with an experienced mentor.',
  },
  {
    icon: ShieldCheck,
    title: 'Risk management first',
    desc: 'Position sizing, stop losses and capital protection are taught before any strategy.',
  },
  {
    icon: NotebookPen,
    title: 'Journals and reviews',
    desc: 'Keep a trading journal and review it regularly so every trade, good or bad, teaches you something.',
  },
  {
    icon: Brain,
    title: 'Trading psychology',
    desc: 'Build the discipline to follow your plan, handle losses calmly and avoid impulsive decisions.',
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section id="why-us" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-colors duration-200 scroll-mt-16">
      <div className="text-center max-w-xl mx-auto mb-14">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
          Why learn with MoonTech
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm mt-2">
          Practical training built around how the market actually behaves, with support until you are confident.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="group p-6 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.07] hover:border-blue-500/30 dark:hover:border-blue-400/30 hover:-translate-y-1.5 hover:shadow-xl shadow-xs transition-all duration-300 cursor-default"
            >
              <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:scale-110 transition-all duration-200">
                <Icon className="w-4 h-4 text-blue-600 group-hover:text-white transition-colors duration-200" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-white mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                {f.title}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{f.desc}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
