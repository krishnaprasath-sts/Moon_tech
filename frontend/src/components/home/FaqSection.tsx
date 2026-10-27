"use client";

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const FAQ = [
  {
    question: 'I have never bought a share. Can I still join?',
    answer:
      'Yes. Stock Market Basics starts from zero. We explain everything in simple words. Most of our students start here.',
  },
  {
    question: 'Is this a stock tips or advisory service?',
    answer:
      'No. We only teach. We do not tell you which shares to buy or sell. You learn to decide for yourself.',
  },
  {
    question: 'When are the classes held?',
    answer:
      'In the evenings and on weekends, so you can join even if you work. Live market classes are held during market hours. Every class is recorded.',
  },
  {
    question: 'What do I need to attend?',
    answer:
      'A phone or laptop with internet. A demat account helps for practice. If you do not have one, we show you how to open it.',
  },
  {
    question: 'How much money do I need?',
    answer:
      'You need no money to learn. When you start practising, use only a small amount you can afford to lose.',
  },
  {
    question: 'How do I join?',
    answer:
      'Sign up, confirm your email and log in. You will see all courses, timings and fees there.',
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
        <div data-reveal className="text-center mb-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
            Common questions
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm mt-2">
            Simple answers to common questions.
          </p>
        </div>

        <div data-reveal-group className="space-y-2.5">
          {FAQ.map((item, index) => {
            const expanded = openIndex === index;
            return (
              <div
                data-reveal
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
