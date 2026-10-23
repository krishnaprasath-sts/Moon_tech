"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CircleHelp, X } from 'lucide-react';

/**
 * Help panel with short answers to the most common questions. It deliberately
 * does not pretend to be a live chat: there is no support agent behind it.
 */
const FAQ = [
  {
    question: 'How do I add money to my wallet?',
    answer:
      'Go to Wallet, choose Add money, transfer the amount to the company bank account shown (NEFT, IMPS or RTGS), then enter the transfer reference and upload the receipt. Your wallet is credited once an admin verifies the payment.',
  },
  {
    question: 'How is the profit calculated?',
    answer:
      'Each plan states a monthly rate on your invested capital, paid as 20 equal credits into your profit wallet on working days at 6:00 AM IST. A one-year plan pays exactly twelve months of the rate.',
  },
  {
    question: 'When can I withdraw?',
    answer:
      'Profit any time. Capital any time too: your capital wallet and matured investments are paid in full, while closing a running plan before it ends deducts the early withdrawal fee shown before you confirm.',
  },
  {
    question: 'Where is my money paid?',
    answer:
      'To the bank account saved under Profile, Bank details. Keep it up to date before you request a withdrawal.',
  },
];

export const FloatingSupport: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="fixed bottom-6 right-4 sm:right-6 z-40 flex flex-col items-end">
      {isOpen && (
        <div
          role="dialog"
          aria-label="Help"
          className="mb-4 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col transition-colors duration-200 animate-fade-in"
        >
          <div className="bg-zinc-50 dark:bg-zinc-950 px-4 py-3 border-b border-zinc-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CircleHelp className="w-4 h-4 text-blue-600" />
              <div>
                <h4 className="font-semibold text-xs text-zinc-950 dark:text-white">Need help?</h4>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Quick answers about deposits, plans and payouts</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close help"
              className="text-zinc-400 hover:text-zinc-950 dark:hover:text-white p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 max-h-80 overflow-y-auto space-y-1.5 text-xs bg-zinc-50/50 dark:bg-zinc-950/60">
            {FAQ.map((item, index) => {
              const expanded = openIndex === index;
              return (
                <div key={item.question} className="rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(expanded ? null : index)}
                    aria-expanded={expanded}
                    className="w-full text-left px-3 py-2.5 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center justify-between gap-2"
                  >
                    <span>{item.question}</span>
                    <span className="text-zinc-400 shrink-0" aria-hidden="true">
                      {expanded ? '−' : '+'}
                    </span>
                  </button>
                  {expanded && (
                    <p className="px-3 pb-3 text-zinc-600 dark:text-zinc-400 leading-relaxed">{item.answer}</p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="p-2.5 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/10 flex items-center justify-between gap-2 text-xs">
            <span className="text-zinc-500 text-[11px]">Ready to start?</span>
            <Link
              href="/plans"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 font-semibold hover:opacity-90 transition"
            >
              View plans <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-label={isOpen ? 'Close help' : 'Open help'}
        className="w-11 h-11 rounded-full bg-zinc-900 text-white dark:bg-white/10 hover:bg-zinc-800 dark:hover:bg-white/20 flex items-center justify-center border border-zinc-700 dark:border-white/10 shadow-lg backdrop-blur-md transition active:scale-95"
      >
        {isOpen ? <X className="w-4 h-4" /> : <CircleHelp className="w-4 h-4" />}
      </button>
    </div>
  );
};
