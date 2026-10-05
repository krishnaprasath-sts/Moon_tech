"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsyncData } from '@/lib/useAsyncData';
import {
  estimateProfit,
  formatDate,
  formatDuration,
  formatINR,
  formatPlanRange,
  formatProfit,
  parseAmount,
} from '@/lib/format';

export const EarningCalculator: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const plans = useAsyncData(api.getInvestmentPlans);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // null = follow the selected plan's minimum
  const [amountInput, setAmountInput] = useState<string | null>(null);
  // Fixed for this visit so the projected date does not change between renders
  const [today] = useState(() => Date.now());

  const list = plans.data || [];
  const plan = list.find((item) => item.id === selectedId) || list[0] || null;

  const input = amountInput ?? (plan ? String(plan.minAmount) : '');
  const parsed = parseAmount(input, 'Investment amount');
  let amountError = parsed.error;
  if (plan && parsed.value !== null) {
    if (parsed.value < plan.minAmount) amountError = `The minimum for this plan is ${formatINR(plan.minAmount)}.`;
    else if (parsed.value > plan.maxAmount) amountError = `The maximum for this plan is ${formatINR(plan.maxAmount)}.`;
  }
  const amount = parsed.value ?? 0;

  // Estimate only: the server calculates the real figures when an investment is confirmed.
  const profit = plan ? estimateProfit(plan, amount) : 0;
  const maturityAmount = amount + profit;
  const returnPct = amount > 0 ? (profit / amount) * 100 : 0;
  const annualisedPct = plan && plan.durationDays > 0 ? (returnPct * 365) / plan.durationDays : 0;
  const maturityDate = plan ? new Date(today + plan.durationDays * 24 * 60 * 60 * 1000).toISOString() : null;

  return (
    <div className={`w-full rounded-2xl bg-white dark:bg-zinc-950/80 border border-zinc-200/90 dark:border-white/[0.08] shadow-xs ${compact ? 'p-5' : 'p-6 sm:p-10'} transition-colors duration-200`}>
      {!compact && (
        <div className="text-center mb-10 max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-white tracking-tight">
            Investment Return Calculator
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
            Pick a plan and an amount to see the expected profit and maturity amount.
          </p>
        </div>
      )}

      {plans.error && !plans.data ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-xs text-zinc-500">We could not load the investment plans right now.</p>
          <button
            type="button"
            onClick={plans.reload}
            className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            Try again
          </button>
        </div>
      ) : !plans.data ? (
        <div className="h-72 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" aria-busy="true" />
      ) : !plan ? (
        <p className="text-center py-10 text-xs text-zinc-500">No investment plans are open right now. Please check back soon.</p>
      ) : (
        <>
          {/* Plan Chips Selector */}
          <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 border-b border-zinc-100 dark:border-white/[0.06]">
            {list.map((p) => {
              const isSelected = plan.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => {
                    setSelectedId(p.id);
                    setAmountInput(null);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-1.5 flex-shrink-0 ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs font-semibold'
                      : 'bg-zinc-100 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06]'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className={`text-[10px] ${isSelected ? 'text-zinc-300 dark:text-zinc-600' : 'text-zinc-400 dark:text-zinc-500'}`}>
                    {formatProfit(p.profitType, p.profitValue)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* Left Input Column */}
            <div className="lg:col-span-6 space-y-6">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor={compact ? 'calc-amount-compact' : 'calc-amount'} className="text-xs font-medium text-zinc-700 dark:text-zinc-400">
                    Investment Amount
                  </label>
                  <span className="text-[11px] text-zinc-500 tabular-nums font-medium">{formatPlanRange(plan)}</span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-base font-semibold text-zinc-500">₹</span>
                  <input
                    id={compact ? 'calc-amount-compact' : 'calc-amount'}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={input}
                    onChange={(e) => setAmountInput(e.target.value)}
                    aria-invalid={Boolean(amountError)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-white/[0.09] rounded-xl pl-9 pr-4 py-3 text-base text-zinc-900 dark:text-white tabular-nums font-semibold focus:outline-none focus:border-zinc-400 dark:focus:border-white/30 transition"
                  />
                </div>
                {amountError && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5">{amountError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Profit</div>
                  <div className="tabular-nums font-semibold text-zinc-900 dark:text-white mt-0.5">
                    {formatProfit(plan.profitType, plan.profitValue)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider text-zinc-500">Investment period</div>
                  <div className="font-semibold text-zinc-900 dark:text-white mt-0.5">{formatDuration(plan.durationDays)}</div>
                </div>
              </div>

              {plan.description && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{plan.description}</p>
              )}

              <Link
                href={`/plans?plan=${plan.id}`}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-center text-xs transition flex items-center justify-center gap-1.5 shadow-sm active:scale-98"
              >
                <span>Invest in {plan.name}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Right Output Column */}
            <div className="lg:col-span-6 bg-zinc-50 dark:bg-zinc-900/30 p-6 rounded-2xl border border-zinc-200 dark:border-white/[0.07] flex flex-col justify-between space-y-6">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.06]">
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600" /> Projected Return
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">{formatDuration(plan.durationDays)}</span>
                </div>

                <div className="divide-y divide-zinc-200 dark:divide-white/[0.04] text-xs">
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Amount invested</span>
                    <span className="tabular-nums text-zinc-950 dark:text-white font-medium">{formatINR(amount)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Expected profit</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">+{formatINR(profit)}</span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Return over the term</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">+{returnPct.toFixed(2)}%</span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Simple annualised return</span>
                    <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">{annualisedPct.toFixed(2)}% p.a.</span>
                  </div>
                  <div className="py-2.5 flex justify-between items-center">
                    <span className="text-zinc-600 dark:text-zinc-400">Matures on (if invested today)</span>
                    <span className="text-zinc-950 dark:text-white font-medium">{formatDate(maturityDate)}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] shadow-xs">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-medium">
                  Maturity amount ({formatDuration(plan.durationDays)})
                </div>
                <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight mt-0.5">
                  {formatINR(maturityAmount)}
                </div>
                <div className="text-[11px] text-zinc-500 mt-1">
                  Estimate for illustration. The final figures are confirmed when you invest.
                </div>
              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
};
