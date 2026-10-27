"use client";

import { useCallback } from 'react';

import Link from 'next/link';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { RequireAuth } from '@/components/layout/RequireAuth';
import { ArrowRight, Star } from 'lucide-react';
import { api, InvestmentPlan } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import {
  exampleAmount,
  estimateProfit,
  formatDuration,
  formatINRShort,
  formatPlanRange,
  formatProfit,
  isOpenEndedPlan,
  monthlyProfitFor,
} from '@/lib/format';

/** Expected profit over the term as a percentage of the minimum investment, used only to rank plans. */
function returnRate(plan: InvestmentPlan): number {
  if (plan.profitType === 'PERCENTAGE') return Number(plan.profitValue) || 0;
  return plan.minAmount > 0 ? (Number(plan.profitValue) / plan.minAmount) * 100 : 0;
}

const cardClass =
  'p-6 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.08] hover:border-zinc-300 dark:hover:border-white/[0.16] shadow-xs transition duration-200 flex flex-col justify-between';
const tagClass =
  'inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider bg-blue-600/10 px-2 py-0.5 rounded border border-blue-600/20';
const primaryLinkClass =
  'w-full py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 font-medium text-xs text-center transition flex items-center justify-center gap-1.5 shadow-xs';
const secondaryLinkClass =
  'w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-950 font-medium text-xs text-center border border-zinc-200 dark:border-white/[0.08] transition flex items-center justify-center gap-1.5';

interface FeaturedCard {
  plan: InvestmentPlan;
  tag: string;
  /** Admin-written tagline, or a generated description when none is set */
  blurb: string;
  primary: boolean;
}

function describePlan(plan: InvestmentPlan): string {
  if (plan.payoutMode === 'MONTHLY') {
    return `${plan.profitValue}% of your capital credited to your profit wallet every month on your start date at 6:00 AM for ${formatDuration(
      plan.durationDays
    )}. Your capital is returned at maturity, or earlier if you close the plan.`;
  }
  if (plan.payoutMode === 'DAILY') {
    const rate = formatProfit(plan.profitType, plan.profitValue, plan.payoutMode, plan.rateBasis);
    return isOpenEndedPlan(plan)
      ? `${rate} on your capital, credited to your profit wallet every working day at 6:00 AM. Close the plan whenever you like.`
      : `${rate} on your capital, credited to your profit wallet every working day at 6:00 AM for ${formatDuration(
          plan.durationDays
        )}. Your capital is returned at maturity, or earlier if you close the plan.`;
  }
  return `Expected profit of ${formatProfit(plan.profitType, plan.profitValue)} over a ${formatDuration(
    plan.durationDays
  )} term, paid with your principal at maturity as per the plan terms.`;
}

/**
 * Plans the admin marked as featured, in the admin's order. When nothing is
 * featured, fall back to the highest-return and the easiest-to-start plan so
 * the page is never empty.
 */
function buildCards(featured: InvestmentPlan[] | null, all: InvestmentPlan[] | null): FeaturedCard[] {
  const active = (featured || []).filter((plan) => plan.isActive);
  if (active.length > 0) {
    return active.map((plan, index) => ({
      plan,
      tag: index === 0 ? 'Featured plan' : 'Featured',
      blurb: plan.featuredTagline || describePlan(plan),
      primary: index === 0,
    }));
  }

  const list = (all || []).filter((plan) => plan.isActive);
  const topPlan = [...list].sort((a, b) => returnRate(b) - returnRate(a))[0];
  const lowestMinPlan = [...list].sort((a, b) => a.minAmount - b.minAmount)[0];
  const cards: FeaturedCard[] = [];
  if (topPlan) cards.push({ plan: topPlan, tag: 'Highest expected profit', blurb: describePlan(topPlan), primary: true });
  if (lowestMinPlan && lowestMinPlan.id !== topPlan?.id) {
    cards.push({
      plan: lowestMinPlan,
      tag: 'Easy to start',
      blurb: isOpenEndedPlan(lowestMinPlan)
        ? `Start investing with as little as ${formatINRShort(lowestMinPlan.minAmount)}; close the plan whenever you like.`
        : `Start investing with as little as ${formatINRShort(lowestMinPlan.minAmount)} for ${formatDuration(
            lowestMinPlan.durationDays
          )}.`,
      primary: false,
    });
  }
  return cards;
}

function PlanOfferCard({ card }: { card: FeaturedCard }) {
  const { plan } = card;
  const example = exampleAmount(plan);
  return (
    <div className={cardClass}>
      <div>
        <span className={tagClass}>
          <Star className="w-3 h-3" aria-hidden="true" />
          {card.tag}
        </span>
        <h3 className="text-base font-semibold text-zinc-950 dark:text-white mt-4 mb-2">{plan.name}</h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">{card.blurb}</p>
      </div>

      <div>
        <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.06] mb-5">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            {plan.payoutMode === 'DAILY' || plan.payoutMode === 'MONTHLY' ? 'Profit rate' : 'Expected profit'}
          </div>
          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
            {formatProfit(plan.profitType, plan.profitValue, plan.payoutMode, plan.rateBasis)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {plan.payoutMode === 'DAILY'
              ? `e.g. ${formatINRShort(example)} earns ${formatINRShort(monthlyProfitFor(plan, example))} a month, paid every working day`
              : plan.payoutMode === 'MONTHLY'
              ? `e.g. ${formatINRShort(example)} earns ${formatINRShort(monthlyProfitFor(plan, example))} a month, paid on your start date`
              : `e.g. ${formatINRShort(example)} becomes ${formatINRShort(example + estimateProfit(plan, example))} in ${formatDuration(
                  plan.durationDays
                )}`}{' '}
            · Invest {formatPlanRange(plan)}
          </div>
        </div>

        <Link href={`/plans?plan=${plan.id}`} className={card.primary ? primaryLinkClass : secondaryLinkClass}>
          <span>{card.primary ? 'Invest now' : 'Explore plan'}</span>
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}

export default function OffersPage() {
  return (
    <RequireAuth message="Loading featured plans...">
      <OffersContent />
    </RequireAuth>
  );
}

function OffersContent() {
  const featured = useAsyncData(api.getFeaturedPlans);
  const plans = useAsyncData(api.getInvestmentPlans);
  const { token } = useAuth({ required: false });
  const referralsFetcher = useCallback(() => api.getMyReferrals(token as string), [token]);
  const referrals = useAsyncData(token ? referralsFetcher : null);

  const loading = (!featured.data && !featured.error) || (!plans.data && !plans.error);
  const failed = Boolean(featured.error && plans.error && !featured.data && !plans.data);
  const cards = buildCards(featured.data, plans.data);

  const reload = () => {
    featured.reload();
    plans.reload();
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-blue-600 selection:text-white transition-colors duration-200">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 w-full">
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-zinc-950 dark:text-white tracking-tight">
            Featured plans &amp; referrals
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
            Plans we are highlighting right now, and how to invite friends to invest with you.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true">
            {[1, 2, 3].map((n) => (
              <div key={n} className="p-6 rounded-2xl bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-200 dark:border-white/[0.08] animate-pulse h-72" />
            ))}
          </div>
        ) : (
          <>
            {failed && (
              <div role="alert" className="mb-5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center justify-between gap-3">
                <span>We could not load the investment plans right now.</span>
                <button type="button" onClick={reload} className="font-semibold underline">
                  Try again
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {cards.map((card) => (
                <PlanOfferCard key={card.plan.id} card={card} />
              ))}

              {cards.length === 0 && !failed && (
                <div className={`${cardClass} md:col-span-2`}>
                  <div>
                    <span className={tagClass}>Investment plans</span>
                    <h3 className="text-base font-semibold text-zinc-950 dark:text-white mt-4 mb-2">No featured plans yet</h3>
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                      Plans will be listed here as soon as they are available.
                    </p>
                  </div>
                  <Link href="/plans" className={secondaryLinkClass}>
                    <span>View all plans</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}

              {/* Referral */}
              <div className={cardClass}>
                <div>
                  <span className={tagClass}>Referral program</span>
                  <h3 className="text-base font-semibold text-zinc-950 dark:text-white mt-4 mb-2">Invite friends</h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6">
                    Every account gets a unique referral code. Share it with friends so they can enter it when they
                    register. You earn{' '}
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {referrals.data ? `${referrals.data.commissionPercent}%` : 'a commission'}
                    </span>{' '}
                    of every amount they invest, credited to your profit wallet instantly when they invest.
                  </p>
                </div>

                <div>
                  <div className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-white/[0.06] mb-5">
                    <div className="text-[10px] uppercase tracking-wider text-zinc-500">Your referral code</div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-white mt-0.5 font-mono select-all">
                      {referrals.data?.referralCode || 'Shown in your profile'}
                    </div>
                    <div className="text-[10px] text-zinc-500 mt-1">
                      {referrals.data
                        ? `${referrals.data.totalReferrals} referred · ${formatINRShort(referrals.data.totalCommissionEarned)} earned`
                        : token
                        ? 'Open your profile to copy it'
                        : 'Available after you register'}
                    </div>
                  </div>

                  <Link href={token ? '/profile' : '/register'} className={secondaryLinkClass}>
                    <span>{token ? 'View my referral code' : 'Get a referral code'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-8 text-[11px] text-zinc-500 leading-relaxed max-w-2xl">
              Investments carry risk. Profit figures are the expected amounts as per each plan&apos;s terms and are
              confirmed by Clyvus Ventures when you invest.
            </p>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
