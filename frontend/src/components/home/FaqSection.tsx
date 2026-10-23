"use client";

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ = [
  {
    question: 'Do I need any prior experience?',
    answer:
      'No. The Foundations program starts from zero: what a share is, how to open a demat account and how an order is placed. If you already trade, you can start with Technical Analysis or Derivatives.',
  },
  {
    question: 'Is this a tips or advisory service?',
    answer:
      'No. MoonTech provides training only. We teach you how to analyse the market and manage risk; we do not give buy or sell recommendations for specific stocks.',
  },
  {
    question: 'What do I need to attend the sessions?',
    answer:
      'A laptop or phone with an internet connection. A demat and trading account with any SEBI-registered broker is useful for practice, and we show you how to open one in the first module.',
  },
  {
    question: 'Are the classes live or recorded?',
    answer:
      'Both. Classes are held live online so you can ask questions, and recordings are available afterwards in your account if you miss a session or want to revise.',
  },
  {
    question: 'How do I join?',
    answer:
      'Create an account, log in and open your dashboard. From there you can see the available programs, batch timings and everything else you need to get started.',
  },
];

export const FaqSection: React.FC = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section
      id="faq"
      className="py-20 border-t border-zinc-200 dark:border-white/[0.06] bg-zinc-100/50 dark:bg-zinc-950/40 transition-colors duration-200 scroll-mt-16"
    >
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
            Frequently asked questions
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm mt-2">
            Quick answers before you get started.
          </p>
        </div>

        <div className="space-y-2.5">
          {FAQ.map((item, index) => {
            const expanded = openIndex === index;
            return (
              <div
                key={item.question}
                className="rounded-2xl bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-white/[0.07] shadow-xs"
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(expanded ? null : index)}
                  aria-expanded={expanded}
                  className="w-full text-left px-5 py-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between gap-3"
                >
                  <span>{item.question}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {expanded && (
                  <p className="px-5 pb-4 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.answer}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
