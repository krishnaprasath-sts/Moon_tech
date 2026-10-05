"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Star } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsyncData } from '@/lib/useAsyncData';
import { estimateProfit, exampleAmount, formatDuration, formatINRShort, formatPlanRange, formatProfit } from '@/lib/format';

export const PlansGrid: React.FC = () => {
  const plans = useAsyncData(api.getInvestmentPlans);
  const list = (plans.data || []).filter((plan) => plan.isActive);

  return (
    <section id="plans" className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-10 pb-4 border-b border-zinc-200 dark:border-white/[0.06]">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight mb-1">
            Investment Plans
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400 text-sm">
            Fixed-term stock market plans in rupees. Your principal and the expected profit are paid out at maturity, as per the plan terms.
          </p>
        </div>
        <Link
          href="/plans"
          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
        >
          View all plans <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Grid of Plans */}
      {plans.error && !plans.data ? (
        <div role="alert" className="text-center py-16 p-8 rounded-2xl bg-zinc-100 dark:bg-zinc-900/20 border border-zinc-200 dark:border-white/[0.05] space-y-3">
          <p className="text-zinc-500 text-sm">We could not load the investment plans right now.</p>
          <button
            type="button"
            onClick={plans.reload}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
          >
            Try again
          </button>
        </div>
      ) : !plans.data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="p-6 rounded-2xl bg-zinc-100 dark:bg-zinc-900/20 border border-zinc-200 dark:border-white/[0.05] animate-pulse h-64" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16 p-8 rounded-2xl bg-zinc-100 dark:bg-zinc-900/20 border border-zinc-200 dark:border-white/[0.05]">
          <p className="text-zinc-500 text-sm">No investment plans are open right now. Please check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.map((plan) => {
            const example = exampleAmount(plan);
            const exampleProfit = estimateProfit(plan, example);
            return (
              <div
                key={plan.id}
                className="p-6 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200/90 dark:border-white/[0.07] hover:border-zinc-300 dark:hover:border-white/[0.16] transition duration-200 flex flex-col justify-between shadow-xs group"
              >
                <div>
                  {/* Plan Header */}
                  <div className="flex items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] flex items-center justify-center text-zinc-900 dark:text-white text-base font-semibold shrink-0" aria-hidden="true">
                        ₹
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <h3 className="font-bold text-zinc-950 dark:text-white text-base leading-snug truncate">{plan.name}</h3>
                          {plan.isFeatured && (
                            <span className="inline-flex items-center gap-1 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                              <Star className="w-2.5 h-2.5" aria-hidden="true" />
                              Featured
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500">{formatDuration(plan.durationDays)} term</p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatProfit(plan.profitType, plan.profitValue)}
                      </div>
                      <div className="text-[10px] text-zinc-500">
                        {plan.profitType === 'FIXED' ? 'expected profit at maturity' : 'expected profit over the term'}
                      </div>
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4 line-clamp-3">{plan.description}</p>
                  )}

                  {/* Minimalist Specs Row */}
                  <div className="py-3.5 border-t border-b border-zinc-100 dark:border-white/[0.06] space-y-2 text-xs">
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-zinc-500 dark:text-zinc-400">Investment range</span>
                      <span className="tabular-nums text-zinc-900 dark:text-zinc-200 font-medium text-right">{formatPlanRange(plan)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-zinc-500 dark:text-zinc-400">Investment period</span>
                      <span className="text-zinc-900 dark:text-zinc-200 font-medium">{formatDuration(plan.durationDays)}</span>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span className="text-zinc-500 dark:text-zinc-400">Payout</span>
                      <span className="text-zinc-700 dark:text-zinc-300">At maturity, on request</span>
                    </div>
                  </div>

                  <p className="mt-3.5 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    <span className="text-zinc-500">Example: </span>
                    <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">{formatINRShort(example)}</span> becomes{' '}
                    <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatINRShort(example + exampleProfit)}</span> in{' '}
                    {formatDuration(plan.durationDays)}.
                  </p>
                </div>

                <Link
                  href={`/plans?plan=${plan.id}`}
                  className="mt-5 w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.04] dark:hover:bg-white text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-950 font-medium text-xs text-center border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white transition active:scale-98"
                >
                  Invest in this plan
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
