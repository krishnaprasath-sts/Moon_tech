import React from 'react';
import { BookOpen, Brain, Headset, MonitorPlay, NotebookPen, ShieldCheck } from 'lucide-react';

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Step-by-step lessons',
    desc: 'Lessons go from easy to advanced, in the right order. Nothing important is skipped.',
  },
  {
    icon: MonitorPlay,
    title: 'Learn on the real market',
    desc: 'Classes use the real market while it is open, not just slides.',
  },
  {
    icon: Headset,
    title: 'Your own mentor',
    desc: 'Ask questions any time. Your mentor clears your doubts and checks your trades.',
  },
  {
    icon: ShieldCheck,
    title: 'Safety first',
    desc: 'Before anything else, you learn how to protect your money and limit losses.',
  },
  {
    icon: NotebookPen,
    title: 'Learn from every trade',
    desc: 'Write down each trade and review it with your mentor, so you keep getting better.',
  },
  {
    icon: Brain,
    title: 'Stay calm and patient',
    desc: 'Learn to control fear and greed and stick to your plan, even after a loss.',
  },
];

export const FeaturesSection: React.FC = () => {
  return (
    <section id="why-us" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 transition-colors duration-200 scroll-mt-16">
      <div data-reveal className="text-center max-w-xl mx-auto mb-14">
        <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
          Why learn with Clyvus Ventures
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm mt-2">
          Simple, practical training with support until you can trade on your own.
        </p>
      </div>

      <div data-reveal-group className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              data-reveal
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
