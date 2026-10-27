import React from 'react';

const STEPS = [
  {
    step: '01',
    title: 'Create your account',
    desc: 'Sign up with your name, email and mobile number. It takes one minute.',
  },
  {
    step: '02',
    title: 'Choose a course',
    desc: 'New to shares? Start with Stock Market Basics. Already know a little? Pick any course.',
  },
  {
    step: '03',
    title: 'Join live classes',
    desc: 'Learn online from your phone or laptop. Missed a class? Watch the recording.',
  },
  {
    step: '04',
    title: 'Practise with a mentor',
    desc: 'Try what you learned in the real market. Your mentor checks your trades and helps you improve.',
  },
];

export const StepsSection: React.FC = () => {
  return (
    <section
      id="how-it-works"
      className="py-20 border-t border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-100/50 dark:bg-zinc-950/40 transition-colors duration-200 scroll-mt-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div data-reveal className="text-center max-w-xl mx-auto mb-14">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">How it works</h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm mt-2">
            Four easy steps to get started.
          </p>
        </div>

        <div data-reveal-group className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {STEPS.map((s) => (
            <div
              data-reveal
              key={s.step}
              className="group p-6 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.07] hover:border-blue-500/30 dark:hover:border-blue-400/30 hover:-translate-y-1.5 hover:shadow-xl shadow-xs transition-all duration-300 cursor-default"
            >
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-600/10 px-2.5 py-1 rounded-lg border border-blue-600/20 group-hover:bg-blue-600 group-hover:text-white transition-all duration-200 inline-block">
                {s.step}
              </span>
              <h3 className="text-base font-semibold text-zinc-950 dark:text-white mt-4 mb-1.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors duration-200">
                {s.title}
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
