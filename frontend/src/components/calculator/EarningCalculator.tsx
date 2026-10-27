"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, ArrowRight, AlertCircle, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { useAsyncData } from '@/lib/useAsyncData';
import {
  countPayingDays,
  dailyProfitFor,
  weeklyProfitFor,
  monthlyProfitFor,
  estimateProfit,
  isDailyPlan,
  isMonthlyPlan,
  isOpenEndedPlan,
  lockInDescription,
  formatDate,
  formatDuration,
  formatINR,
  formatINRShort,
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
    if (parsed.value < plan.minAmount) {
      amountError = `The minimum for this plan is ${formatINR(plan.minAmount)}.`;
    } else if (parsed.value > plan.maxAmount) {
      amountError = `The maximum for this plan is ${formatINR(plan.maxAmount)}.`;
    }
  }

  const isValid = !amountError && parsed.value !== null && parsed.value > 0;
  const amount: number = isValid && typeof parsed.value === 'number' ? parsed.value : 0;

  // Calculation only runs when amount is valid and within plan boundaries
  const daily = plan ? isDailyPlan(plan) : false;
  const monthly = plan ? isMonthlyPlan(plan) : false;
  const openEnded = plan ? isOpenEndedPlan(plan) : false;
  const dailyProfit = isValid && plan ? dailyProfitFor(plan, amount) : 0;
  const weeklyProfit = isValid && plan ? weeklyProfitFor(plan, amount) : 0;
  const monthlyProfit = isValid && plan ? monthlyProfitFor(plan, amount) : 0;
  // Open-ended plans have no fixed total: show one year of profit as the projection
  const projectionDays = plan ? (openEnded ? 365 : plan.durationDays) : 0;
  const payingDays = plan && daily ? countPayingDays(plan, new Date(today), projectionDays) : 0;
  const profit =
    isValid && plan ? (daily && openEnded ? Math.round(dailyProfit * payingDays * 100) / 100 : estimateProfit(plan, amount)) : 0;
  const maturityAmount = isValid ? amount + profit : 0;
  const returnPct = isValid && amount > 0 ? (profit / amount) * 100 : 0;
  const annualisedPct = isValid && plan && projectionDays > 0 ? (returnPct * 365) / projectionDays : 0;
  const maturityDate = plan && !openEnded ? new Date(today + plan.durationDays * 24 * 60 * 60 * 1000).toISOString() : null;

  // Quick preset shortcuts for convenience
  const presets = plan
    ? [
        { label: 'Min', value: plan.minAmount },
        { label: '₹25K', value: 25000 },
        { label: '₹50K', value: 50000 },
        { label: '₹1L', value: 100000 },
        { label: 'Max', value: plan.maxAmount },
      ].filter((p) => p.value >= plan.minAmount && p.value <= plan.maxAmount)
    : [];

  return (
    <div
      className={`w-full rounded-3xl bg-white dark:bg-[#111114] border border-zinc-200/90 dark:border-white/[0.08] shadow-sm ${
        compact ? 'p-5' : 'p-6 sm:p-10'
      } transition-colors duration-200 overflow-hidden`}
    >
      {!compact && (
        <div className="text-center mb-10 max-w-xl mx-auto">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-3">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Interactive Profit Estimator</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-zinc-950 dark:text-white tracking-tight">
            Investment Return Calculator
          </h2>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-2 leading-relaxed">
            Select a plan and adjust your capital to see the daily, weekly and monthly profit it earns.
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
        <p className="text-center py-10 text-xs text-zinc-500">
          No investment plans are open right now. Please check back soon.
        </p>
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
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition flex items-center gap-2 flex-shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950 shadow-xs font-semibold'
                      : 'bg-zinc-100 dark:bg-white/[0.03] text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-white/[0.06]'
                  }`}
                >
                  <span>{p.name}</span>
                  <span
                    className={`text-[10px] font-semibold ${
                      isSelected ? 'text-blue-300 dark:text-blue-600' : 'text-zinc-400 dark:text-zinc-500'
                    }`}
                  >
                    {formatProfit(p.profitType, p.profitValue, p.payoutMode, p.rateBasis)}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left Input Column */}
            <div className="lg:col-span-6 space-y-5 min-w-0">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label
                    htmlFor={compact ? 'calc-amount-compact' : 'calc-amount'}
                    className="text-xs font-medium text-zinc-700 dark:text-zinc-300"
                  >
                    Investment Amount
                  </label>
                  <span className="text-[11px] text-zinc-500 tabular-nums font-medium">
                    {formatPlanRange(plan)}
                  </span>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-3 text-base font-semibold text-zinc-500">₹</span>
                  <input
                    id={compact ? 'calc-amount-compact' : 'calc-amount'}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={12}
                    value={input}
                    onChange={(e) => {
                      // Discard non-numeric characters except single decimal point
                      const val = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = val.split('.');
                      const clean = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : val;
                      setAmountInput(clean);
                    }}
                    aria-invalid={Boolean(amountError)}
                    className={`w-full bg-zinc-50/80 dark:bg-zinc-900/60 border rounded-2xl pl-9 pr-4 py-3 text-base tabular-nums font-semibold focus:outline-none transition ${
                      amountError
                        ? 'border-rose-500/80 dark:border-rose-500/80 text-rose-950 dark:text-rose-200 focus:ring-2 focus:ring-rose-500/20'
                        : 'border-zinc-200 dark:border-white/[0.09] text-zinc-900 dark:text-white focus:border-blue-500 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20'
                    }`}
                  />
                </div>

                {/* Error Banner */}
                {amountError ? (
                  <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-2 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{amountError}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    Enter any amount between {formatINRShort(plan.minAmount)} and {formatINRShort(plan.maxAmount)}.
                  </p>
                )}

                {/* Quick Preset Buttons */}
                {presets.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400 mr-1">
                      Quick:
                    </span>
                    {presets.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setAmountInput(String(preset.value))}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800/80 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-white/[0.06] transition active:scale-95 cursor-pointer"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Plan Specs Overview */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">Profit Rate</div>
                  <div className="tabular-nums font-bold text-zinc-950 dark:text-white mt-1 text-sm">
                    {formatProfit(plan.profitType, plan.profitValue, plan.payoutMode, plan.rateBasis)}
                  </div>
                </div>
                <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-white/[0.06]">
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                    Term
                  </div>
                  <div className="font-bold text-zinc-950 dark:text-white mt-1 text-sm">
                    {formatDuration(plan.durationDays)}
                  </div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">{lockInDescription(plan)}</div>
                </div>
              </div>

              {plan.description && (
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">{plan.description}</p>
              )}

              {/* Action Button */}
              {isValid ? (
                <Link
                  href={`/plans?plan=${plan.id}`}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs text-center transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20 active:scale-[0.99] cursor-pointer"
                >
                  <span>Invest in {plan.name}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 text-zinc-400 dark:text-zinc-500 font-semibold text-xs text-center cursor-not-allowed border border-zinc-200 dark:border-white/[0.05]"
                >
                  Enter a valid amount within plan limits
                </button>
              )}
            </div>

            {/* Right Output Column (Projected Return) */}
            <div className="lg:col-span-6 bg-zinc-50 dark:bg-zinc-900/40 p-6 rounded-3xl border border-zinc-200/80 dark:border-white/[0.07] flex flex-col justify-between space-y-6 overflow-hidden min-w-0 max-w-full">
              <div className="min-w-0">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.06]">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span>Projected Return</span>
                  </span>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {openEnded ? 'per year' : formatDuration(plan.durationDays)}
                  </span>
                </div>

                {/* If amount is invalid / exceeds max, display a clean warning box instead of running runaway calculations */}
                {!isValid ? (
                  <div className="py-6 space-y-3">
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-3">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <span className="font-semibold">Calculation paused</span>
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                          {amountError || 'Please enter an investment amount to view projected returns.'}
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-zinc-200 dark:divide-white/[0.04] text-xs opacity-40">
                      <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                        <span className="text-zinc-500 shrink-0">Amount invested</span>
                        <span className="tabular-nums text-zinc-400 font-medium">—</span>
                      </div>
                      <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                        <span className="text-zinc-500 shrink-0">Expected profit</span>
                        <span className="tabular-nums text-zinc-400 font-medium">—</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-white/[0.04] text-xs min-w-0">
                    <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                      <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Amount invested</span>
                      <span
                        className="tabular-nums text-zinc-950 dark:text-white font-semibold text-right truncate min-w-0 max-w-[60%]"
                        title={formatINR(amount)}
                      >
                        {formatINR(amount)}
                      </span>
                    </div>

                    {monthly && (
                      <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                        <span className="text-zinc-600 dark:text-zinc-400 shrink-0">
                          Monthly profit ({plan.profitValue}% on start date)
                        </span>
                        <span
                          className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold text-right truncate min-w-0 max-w-[60%]"
                          title={`+${formatINR(monthlyProfit)}`}
                        >
                          +{formatINR(monthlyProfit)}
                        </span>
                      </div>
                    )}

                    {daily && (
                      <>
                        <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                          <span className="text-zinc-600 dark:text-zinc-400 shrink-0">
                            Daily profit (Mon–Fri, 6:00 AM)
                          </span>
                          <span
                            className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold text-right truncate min-w-0 max-w-[60%]"
                            title={`+${formatINR(dailyProfit)}`}
                          >
                            +{formatINR(dailyProfit)}
                          </span>
                        </div>
                        <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                          <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Weekly profit (5 days)</span>
                          <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold text-right truncate min-w-0 max-w-[60%]">
                            +{formatINR(weeklyProfit)}
                          </span>
                        </div>
                        <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                          <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Monthly profit (20 days)</span>
                          <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold text-right truncate min-w-0 max-w-[60%]">
                            +{formatINR(monthlyProfit)}
                          </span>
                        </div>
                      </>
                    )}

                    <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                      <span className="text-zinc-600 dark:text-zinc-400 shrink-0">
                        {monthly
                          ? `Total profit (${formatDuration(plan.durationDays)})`
                          : daily
                          ? (openEnded ? `Profit in 1 year (${payingDays} days)` : `Total profit (${payingDays} days)`)
                          : 'Expected profit'}
                      </span>
                      <span
                        className="tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold text-right truncate min-w-0 max-w-[60%]"
                        title={`+${formatINR(profit)}`}
                      >
                        +{formatINR(profit)}
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                      <span className="text-zinc-600 dark:text-zinc-400 shrink-0">
                        {openEnded ? 'Return in 1 year' : 'Return over the term'}
                      </span>
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        +{returnPct.toFixed(2)}%
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                      <span className="text-zinc-600 dark:text-zinc-400 shrink-0">Simple annualised return</span>
                      <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-bold shrink-0">
                        {annualisedPct.toFixed(2)}% p.a.
                      </span>
                    </div>

                    <div className="py-2.5 flex justify-between items-center gap-3 min-w-0">
                      <span className="text-zinc-600 dark:text-zinc-400 shrink-0">
                        {openEnded ? 'Capital locked' : 'Matures on (if invested today)'}
                      </span>
                      <span className="text-zinc-950 dark:text-white font-medium shrink-0">
                        {openEnded ? 'No lock-in · close any time' : formatDate(maturityDate)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Total Received / Maturity Highlight Box */}
              <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.08] shadow-xs overflow-hidden min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 font-semibold">
                  {monthly || daily ? 'Capital + Profit' : 'Maturity Amount'} ({openEnded ? 'after 1 year' : formatDuration(plan.durationDays)})
                </div>
                <div
                  className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums tracking-tight mt-1 truncate min-w-0 max-w-full"
                  title={isValid ? formatINR(maturityAmount) : '—'}
                >
                  {isValid ? formatINR(maturityAmount) : '—'}
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                  {isValid
                    ? monthly
                      ? 'Profit is credited to your profit wallet on your start date each month at 6:00 AM IST and can be withdrawn any time. Your capital returns to your capital wallet in full at maturity.'
                      : daily
                      ? openEnded
                        ? 'Profit is credited to your profit wallet every working day at 6:00 AM IST and can be withdrawn any time. Your capital keeps earning until you close the plan.'
                        : 'Profit is credited to your profit wallet every working day at 6:00 AM IST; your capital returns to your capital wallet at maturity.'
                      : 'Principal plus expected profit returned at maturity as per the plan terms.'
                    : `Enter an amount between ${formatINRShort(plan.minAmount)} and ${formatINRShort(plan.maxAmount)} to calculate returns.`}
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
