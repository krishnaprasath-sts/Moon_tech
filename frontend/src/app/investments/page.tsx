"use client";

import React, { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, ChevronDown, Clock, Eye, Plus, TrendingUp, X } from 'lucide-react';
import {
  api,
  getErrorMessage,
  Investment,
  InvestmentStatus,
  PayoutDetails,
  PayoutMethod,
  Withdrawal,
} from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import {
  BUCKET_LABELS,
  formatDate,
  formatDateTime,
  formatINR,
  formatProfit,
  PAYOUT_TIME_LABEL,
} from '@/lib/format';
import {
  accentButtonClass,
  Alert,
  CardHeader,
  cardClass,
  chipClass,
  DetailRow,
  EmptyState,
  ErrorState,
  FullPageMessage,
  LoadingRows,
  Modal,
  PageHeader,
  PageShell,
  Pagination,
  primaryButtonClass,
  secondaryButtonClass,
  Spinner,
  StatusBadge,
} from '@/components/ui/primitives';
import { useFileViewer } from '@/components/ui/FileViewer';

const PAGE_SIZE = 10;

type Tab = 'ALL' | InvestmentStatus | 'WITHDRAWALS';

const TABS: { id: Tab; label: string }[] = [
  { id: 'ALL', label: 'All' },
  { id: 'ACTIVE', label: 'Active' },
  { id: 'MATURED', label: 'Matured' },
  { id: 'WITHDRAWAL_REQUESTED', label: 'Withdrawal requested' },
  { id: 'COMPLETED', label: 'Completed' },
  { id: 'CANCELLED', label: 'Cancelled' },
  { id: 'WITHDRAWALS', label: 'Withdrawal requests' },
];

function initialTab(tab: string | null, status: string | null): Tab {
  if (tab === 'withdrawals') return 'WITHDRAWALS';
  const match = TABS.find((item) => item.id === status && item.id !== 'WITHDRAWALS');
  return match ? match.id : 'ALL';
}

export default function InvestmentsPage() {
  return (
    <Suspense fallback={<FullPageMessage>Loading investments...</FullPageMessage>}>
      <InvestmentsContent />
    </Suspense>
  );
}

function InvestmentsContent() {
  const searchParams = useSearchParams();
  const { token, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>(() => initialTab(searchParams.get('tab'), searchParams.get('status')));
  const [page, setPage] = useState(1);
  const [withdrawTarget, setWithdrawTarget] = useState<Investment | null>(null);
  const viewer = useFileViewer();

  const showWithdrawals = tab === 'WITHDRAWALS';

  const investmentsFetcher = useCallback(
    () =>
      api.getInvestments(token as string, {
        page,
        limit: PAGE_SIZE,
        status: tab === 'ALL' || tab === 'WITHDRAWALS' ? '' : tab,
      }),
    [token, page, tab]
  );
  const withdrawalsFetcher = useCallback(
    () => api.getWithdrawals(token as string, { page, limit: PAGE_SIZE }),
    [token, page]
  );

  const investments = useAsyncData(token && !showWithdrawals ? investmentsFetcher : null);
  const withdrawals = useAsyncData(token && showWithdrawals ? withdrawalsFetcher : null);

  if (authLoading || !token) return <FullPageMessage>Loading investments...</FullPageMessage>;

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
  };

  return (
    <PageShell>
      <PageHeader
        title="My investments"
        subtitle="Track your invested capital, the daily profit it earns, maturity dates and withdrawal requests."
        actions={
          <Link href="/plans" className={primaryButtonClass}>
            <Plus className="w-3.5 h-3.5" />
            <span>New investment</span>
          </Link>
        }
      />

      <div className="flex items-center gap-2 flex-wrap" role="tablist" aria-label="Investment filters">
        {TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => changeTab(item.id)}
              className={`${chipClass(selected)} ${item.id === 'WITHDRAWALS' ? 'ml-2' : ''}`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {showWithdrawals ? (
        <div className={`${cardClass} overflow-hidden`}>
          <CardHeader icon={<Banknote />} title="Withdrawal requests" />
          {withdrawals.error && !withdrawals.data ? (
            <ErrorState message={withdrawals.error} onRetry={withdrawals.reload} />
          ) : !withdrawals.data ? (
            <LoadingRows />
          ) : withdrawals.data.items.length === 0 ? (
            <EmptyState
              icon={<Banknote className="w-4 h-4" />}
              title="No withdrawal requests yet"
              description="Profit can be withdrawn any time from the Wallet page; capital is withdrawn by closing an investment or from the capital wallet. Your requests and their payment status will appear here."
              action={
                <Link href="/wallet" className={secondaryButtonClass}>
                  Go to wallet
                </Link>
              }
            />
          ) : (
            <>
              {withdrawals.error && <Alert className="m-4">{withdrawals.error}</Alert>}
              <div
                className={`divide-y divide-zinc-100 dark:divide-white/[0.06] transition-opacity ${withdrawals.loading ? 'opacity-60' : ''}`}
                aria-busy={withdrawals.loading}
              >
                {withdrawals.data.items.map((withdrawal) => (
                  <WithdrawalCard
                    key={withdrawal.id}
                    withdrawal={withdrawal}
                    viewDisabled={viewer.busy}
                    onViewProof={() =>
                      viewer.open(`Payment proof ${withdrawal.reference}`, () =>
                        api.getWithdrawalProof(token, withdrawal.id)
                      )
                    }
                  />
                ))}
              </div>
              <Pagination meta={withdrawals.data.meta} onPageChange={setPage} disabled={withdrawals.loading} />
            </>
          )}
        </div>
      ) : investments.error && !investments.data ? (
        <div className={cardClass}>
          <ErrorState message={investments.error} onRetry={investments.reload} />
        </div>
      ) : !investments.data ? (
        <div className={cardClass}>
          <LoadingRows />
        </div>
      ) : investments.data.items.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={<TrendingUp className="w-4 h-4" />}
            title={tab === 'ALL' ? 'No investments yet' : `No ${TABS.find((item) => item.id === tab)?.label.toLowerCase()} investments`}
            description={
              tab === 'ALL'
                ? 'Choose an investment plan to put your capital to work and start earning daily profit.'
                : 'Investments with this status will appear here.'
            }
            action={
              tab === 'ALL' ? (
                <Link href="/plans" className={accentButtonClass}>
                  <span>View plans</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              ) : (
                <button type="button" onClick={() => changeTab('ALL')} className={secondaryButtonClass}>
                  Show all investments
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          {investments.error && <Alert className="m-4">{investments.error}</Alert>}
          <div
            className={`divide-y divide-zinc-100 dark:divide-white/[0.06] transition-opacity ${investments.loading ? 'opacity-60' : ''}`}
            aria-busy={investments.loading}
          >
            {investments.data.items.map((investment) => (
              <InvestmentCard
                key={investment.id}
                investment={investment}
                token={token}
                onWithdraw={() => setWithdrawTarget(investment)}
              />
            ))}
          </div>
          <Pagination meta={investments.data.meta} onPageChange={setPage} disabled={investments.loading} />
        </div>
      )}

      {withdrawTarget && (
        <WithdrawModal
          key={withdrawTarget.id}
          token={token}
          investment={withdrawTarget}
          onClose={() => setWithdrawTarget(null)}
          onRequested={investments.reload}
          onViewRequests={() => {
            setWithdrawTarget(null);
            changeTab('WITHDRAWALS');
          }}
        />
      )}

      {viewer.modal}
    </PageShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 font-medium">{label}</div>
      <div className="text-xs text-zinc-900 dark:text-zinc-100 font-medium mt-0.5 break-words">{children}</div>
    </div>
  );
}

function nextCreditLabel(investment: Investment): string | null {
  if ((investment.payoutMode !== 'DAILY' && investment.payoutMode !== 'MONTHLY') || !investment.nextCreditAt) return null;
  if (investment.nextCreditDue) return 'Next credit is being processed now';
  const at = new Date(investment.nextCreditAt);
  const now = new Date();
  const sameDay = at.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = at.toDateString() === tomorrow.toDateString();
  const dayLabel = sameDay ? 'today' : isTomorrow ? 'tomorrow' : at.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return `Next credit ${dayLabel} at ${PAYOUT_TIME_LABEL}`;
}

function ProfitHistory({ token, investment }: { token: string; investment: Investment }) {
  const fetcher = useCallback(() => api.getInvestment(token, investment.id), [token, investment.id]);
  const detail = useAsyncData(fetcher);
  if (detail.error && !detail.data) return <ErrorState message={detail.error} onRetry={detail.reload} />;
  if (!detail.data) return <LoadingRows rows={3} />;
  const credits = detail.data.profitCredits || [];
  if (credits.length === 0) {
    return (
      <p className="text-[11px] text-zinc-500 py-2">
        {investment.payoutMode === 'MONTHLY'
          ? `No profit credited yet. Profit is credited monthly on your start date at ${PAYOUT_TIME_LABEL}.`
          : `No profit credited yet. The first credit lands on the first working day after your investment starts, at ${PAYOUT_TIME_LABEL}.`}
      </p>
    );
  }
  return (
    <div className="max-h-64 overflow-y-auto rounded-lg border border-zinc-100 dark:border-white/[0.06]">
      <table className="w-full text-xs">
        <thead className="bg-zinc-50 dark:bg-white/[0.03] text-[10px] uppercase tracking-wider text-zinc-500 sticky top-0">
          <tr>
            <th className="text-left font-semibold px-3 py-2">Day</th>
            <th className="text-left font-semibold px-3 py-2 hidden sm:table-cell">Credited at</th>
            <th className="text-right font-semibold px-3 py-2">Profit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.06]">
          {credits.map((c, i) => (
            <tr key={c.id}>
              <td className="px-3 py-2 text-zinc-800 dark:text-zinc-200">
                <span className="text-zinc-400 tabular-nums mr-2">#{credits.length - i}</span>
                {new Date(`${c.creditDay}T00:00:00+05:30`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                {investment.creditsPerCycle !== null && (
                  <span className="text-[10px] text-zinc-400 ml-2">month {c.cycleNo + 1}</span>
                )}
              </td>
              <td className="px-3 py-2 text-zinc-500 hidden sm:table-cell">{formatDateTime(c.creditedAt)}</td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">+{formatINR(c.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function InvestmentCard({ investment, onWithdraw, token }: { investment: Investment; onWithdraw: () => void; token: string }) {
  const [showHistory, setShowHistory] = useState(false);
  const nextCredit = nextCreditLabel(investment);
  const progress =
    investment.status === 'ACTIVE'
      ? Math.min(100, Math.max(0, Number(investment.progressPercent) || 0))
      : investment.status === 'CANCELLED'
      ? 0
      : 100;
  const daysRemaining = Math.max(0, Number(investment.daysRemaining) || 0);
  const isEarly = investment.status === 'ACTIVE' && investment.earlyWithdrawalAllowed && investment.lockInDays > 0;
  const openEnded = investment.isOpenEnded;
  const showProgress = investment.status !== 'CANCELLED' && !openEnded;
  const daily = investment.payoutMode === 'DAILY';
  const monthly = investment.payoutMode === 'MONTHLY';
  const monthlyPlan = daily && investment.creditsPerCycle !== null;
  const creditedPct =
    (daily || monthly) && investment.expectedProfit > 0
      ? Math.min(100, Math.round((investment.profitCredited / investment.expectedProfit) * 100))
      : 0;
  const cyclePct =
    monthlyPlan && investment.creditsPerCycle
      ? Math.min(100, Math.round((investment.creditsThisCycle / investment.creditsPerCycle) * 100))
      : 0;

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">{investment.planName}</h3>
            <StatusBadge status={investment.status} kind="investment" />
            {isEarly && <StatusBadge status="PENDING" label="Early exit allowed" />}
            {investment.status === 'ACTIVE' && investment.isLocked && (
              <StatusBadge status="PENDING" label={`Locked until ${formatDate(investment.lockInEndsAt)}`} />
            )}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{investment.reference}</div>
        </div>
        {investment.canRequestWithdrawal ? (
          <button
            type="button"
            onClick={onWithdraw}
            className={accentButtonClass}
            title={
              investment.earlyExitFeeApplies
                ? `Closes this investment before it ends. ${investment.feePercent}% early withdrawal fee applies.`
                : 'Pays your capital back in full. No fee.'
            }
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Withdraw capital</span>
          </button>
        ) : investment.status === 'ACTIVE' ? (
          <button
            type="button"
            disabled
            title={`Your capital is locked until ${formatDate(investment.lockInEndsAt)}.${
              investment.maturityDate ? ` It returns to your capital wallet at maturity on ${formatDate(investment.maturityDate)}.` : ''
            }`}
            className={`${secondaryButtonClass} opacity-60 cursor-not-allowed`}
          >
            <Banknote className="w-3.5 h-3.5" />
            <span>Capital locked</span>
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Field label="Capital invested">
          <span className="tabular-nums font-semibold">{formatINR(investment.amount)}</span>
        </Field>
        {daily || monthly ? (
          <Field label="Profit per month">
            <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">+{formatINR(investment.monthlyProfit)}</span>
            <span className="text-zinc-500 font-normal">
              {' '}
              ({formatProfit(investment.profitType, investment.profitValue, investment.payoutMode, investment.rateBasis)})
            </span>
          </Field>
        ) : (
          <Field label="Expected profit">
            <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">+{formatINR(investment.expectedProfit)}</span>
            <span className="text-zinc-500 font-normal"> ({formatProfit(investment.profitType, investment.profitValue, investment.payoutMode)})</span>
          </Field>
        )}
        {daily || monthly ? (
          <Field label="Profit credited so far">
            <span className="tabular-nums font-bold text-emerald-600 dark:text-emerald-400">+{formatINR(investment.profitCredited)}</span>
            {!openEnded && (
              <span className="text-zinc-500 font-normal"> of {formatINR(investment.expectedProfit)} ({creditedPct}%)</span>
            )}
          </Field>
        ) : (
          <Field label="Maturity amount">
            <span className="tabular-nums font-bold">{formatINR(investment.maturityAmount)}</span>
          </Field>
        )}
        <Field label="Start date">{formatDate(investment.startDate)}</Field>
        <Field label={openEnded ? 'Term' : 'Maturity date'}>
          {openEnded ? 'Open-ended · close any time' : formatDate(investment.maturityDate)}
        </Field>
        <Field label="Early withdrawal fee">
          {investment.feePercent}% of capital
          <span className="block text-[10px] text-zinc-500 font-normal">
            {openEnded ? 'applies whenever you close the plan' : 'only if closed before maturity; none after'}
          </span>
        </Field>
      </div>

      {showProgress && (
        <div>
          <div className="flex items-center justify-between text-[11px] text-zinc-500 mb-1">
            <span>
              {investment.status === 'ACTIVE'
                ? daysRemaining > 0
                  ? `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} to maturity`
                  : 'Maturing today'
                : investment.status === 'MATURED'
                ? 'Matured'
                : investment.status === 'WITHDRAWAL_REQUESTED'
                ? 'Capital withdrawal in progress'
                : 'Completed'}
            </span>
            <span className="tabular-nums font-medium">{progress.toFixed(0)}%</span>
          </div>
          <div
            className="h-1.5 rounded-full bg-zinc-100 dark:bg-white/[0.06] overflow-hidden"
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progress to maturity"
          >
            <div
              className={`h-full rounded-full transition-all ${investment.status === 'ACTIVE' ? 'bg-blue-600' : 'bg-emerald-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {(daily || monthly) && (
        <div className="rounded-xl bg-emerald-50/60 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/20 p-3 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-[11px] text-zinc-700 dark:text-zinc-300">
              {monthly ? (
                <>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatINR(investment.monthlyProfit)}</span> a month ({investment.profitValue}%), credited on your start date at {PAYOUT_TIME_LABEL}
                  {' · '}
                  <span className="tabular-nums">{investment.creditedDays} of {investment.profitDays}</span> months credited
                </>
              ) : (
                <>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatINR(investment.dailyProfit)}</span>
                  {investment.dailyRatePercent > 0 && investment.rateBasis !== 'PER_DAY' ? ` (${investment.dailyRatePercent}% of capital)` : ''} every
                  working day (Mon–Fri) at {PAYOUT_TIME_LABEL}
                  {' · '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatINR(investment.weeklyProfit)}</span> a week
                  {' · '}
                  {monthlyPlan && investment.creditsPerCycle ? (
                    <>
                      <span className="tabular-nums">
                        {investment.creditsThisCycle} of {investment.creditsPerCycle}
                      </span>{' '}
                      credits this month ({investment.creditedDays} in total)
                    </>
                  ) : (
                    <>
                      <span className="tabular-nums">
                        {investment.creditedDays} of {investment.profitDays}
                      </span>{' '}
                      days credited
                    </>
                  )}
                </>
              )}
              {investment.status === 'ACTIVE' && !openEnded && <> · capital of {formatINR(investment.amount)} returns at maturity</>}
            </div>
            <div className="flex items-center gap-3">
              {nextCredit && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${investment.nextCreditDue ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  <Clock className="w-3 h-3" /> {nextCredit}
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-1"
                aria-expanded={showHistory}
              >
                {showHistory ? 'Hide profit history' : 'Profit history'}
                <ChevronDown className={`w-3 h-3 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          <div
            className="h-1 rounded-full bg-white dark:bg-white/[0.06] overflow-hidden"
            role="progressbar"
            aria-valuenow={monthly ? creditedPct : monthlyPlan ? cyclePct : creditedPct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={monthly ? 'Profit credited so far' : monthlyPlan ? 'Profit credits this month' : 'Profit credited so far'}
          >
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${monthly ? creditedPct : monthlyPlan ? cyclePct : creditedPct}%` }} />
          </div>
          {showHistory && <ProfitHistory token={token} investment={investment} />}
        </div>
      )}
      {investment.status === 'MATURED' && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          Matured on {formatDate(investment.maturedAt || investment.maturityDate)}.
          {investment.canRequestWithdrawal
            ? daily || monthly
              ? ' Your profit is already in your profit wallet; withdraw your capital now, no fee.'
              : ' You can request your withdrawal now.'
            : ''}
        </p>
      )}
      {investment.status === 'WITHDRAWAL_REQUESTED' && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Capital withdrawal requested; daily profit has stopped. Track it under &quot;Withdrawal requests&quot;.
        </p>
      )}
      {investment.status === 'COMPLETED' && investment.completedAt && (
        <p className="text-[11px] text-zinc-500">
          Completed on {formatDate(investment.completedAt)}.
          {investment.maturedAt && !openEnded
            ? ' Your capital was returned to your capital wallet at maturity; re-invest it or withdraw it from the Wallet page.'
            : ''}
        </p>
      )}
      {investment.status === 'CANCELLED' && (
        <p className="text-[11px] text-zinc-500">
          Cancelled{investment.cancelledAt ? ` on ${formatDate(investment.cancelledAt)}` : ''}
          {investment.cancelReason ? `: ${investment.cancelReason}` : '.'} The capital was refunded to your capital wallet.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Withdrawals
// ---------------------------------------------------------------------------
function payoutDestination(withdrawal: Withdrawal): string {
  if (withdrawal.payoutMethod === 'UPI') return withdrawal.payoutUpiId || 'UPI';
  const parts = [withdrawal.payoutBankName, withdrawal.payoutAccountMasked].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Bank account';
}

type StepState = 'done' | 'current' | 'upcoming' | 'failed';

function WithdrawalTimeline({ withdrawal }: { withdrawal: Withdrawal }) {
  const { status } = withdrawal;
  const rejected = status === 'REJECTED';
  const approved = status === 'APPROVED' || status === 'COMPLETED';
  const paid = status === 'COMPLETED';

  const steps: { label: string; date: string | null; state: StepState; note: string }[] = [
    { label: 'Requested', date: withdrawal.createdAt, state: 'done', note: '' },
    rejected
      ? { label: 'Rejected', date: withdrawal.reviewedAt, state: 'failed', note: '' }
      : {
          label: 'Approved',
          date: approved ? withdrawal.reviewedAt : null,
          state: approved ? 'done' : 'current',
          note: approved ? '' : 'Awaiting admin review',
        },
    {
      label: 'Paid',
      date: paid ? withdrawal.completedAt : null,
      state: paid ? 'done' : rejected ? 'upcoming' : approved ? 'current' : 'upcoming',
      note: paid ? '' : rejected ? '—' : approved ? 'Payment in progress' : 'Pending',
    },
  ];

  const circle: Record<StepState, string> = {
    done: 'bg-emerald-500 border-emerald-500 text-white',
    current: 'bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400',
    upcoming: 'bg-transparent border-zinc-300 dark:border-white/15 text-zinc-400',
    failed: 'bg-rose-500 border-rose-500 text-white',
  };

  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Withdrawal progress">
      {steps.map((step, index) => {
        const next = steps[index + 1];
        const connectorDone = next && (next.state === 'done' || next.state === 'failed');
        return (
          <li key={step.label} aria-current={step.state === 'current' ? 'step' : undefined} className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${circle[step.state]}`}
                aria-hidden="true"
              >
                {step.state === 'done' ? (
                  <Check className="w-3 h-3" />
                ) : step.state === 'failed' ? (
                  <X className="w-3 h-3" />
                ) : (
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                )}
              </span>
              {next && (
                <span className={`h-px flex-1 ${connectorDone ? 'bg-emerald-500/50' : 'bg-zinc-200 dark:bg-white/10'}`} aria-hidden="true" />
              )}
            </div>
            <div
              className={`mt-1.5 text-[11px] font-semibold ${
                step.state === 'failed'
                  ? 'text-rose-600 dark:text-rose-400'
                  : step.state === 'upcoming'
                  ? 'text-zinc-400'
                  : 'text-zinc-900 dark:text-zinc-100'
              }`}
            >
              {step.label}
            </div>
            <div className="text-[10px] text-zinc-500 leading-snug">{step.date ? formatDateTime(step.date) : step.note}</div>
          </li>
        );
      })}
    </ol>
  );
}

function WithdrawalCard({
  withdrawal,
  onViewProof,
  viewDisabled,
}: {
  withdrawal: Withdrawal;
  onViewProof: () => void;
  viewDisabled: boolean;
}) {
  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
              {withdrawal.source === 'WALLET'
                ? `${BUCKET_LABELS[withdrawal.bucket] || 'Wallet'} withdrawal`
                : `${withdrawal.planName || 'Investment'} · capital withdrawal`}
            </h3>
            <StatusBadge status={withdrawal.status} kind="withdrawal" />
            {withdrawal.isEarly && withdrawal.source !== 'WALLET' && <StatusBadge status="PENDING" label="Before maturity" />}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-0.5 break-all">
            {withdrawal.reference}
            {withdrawal.investmentReference ? ` · ${withdrawal.investmentReference}` : ''}
          </div>
        </div>
        <div className="sm:text-right shrink-0">
          <div className="tabular-nums font-bold text-base text-zinc-950 dark:text-white">{formatINR(withdrawal.netAmount)}</div>
          <div className="text-[10px] text-zinc-500 tabular-nums">
            {withdrawal.feeAmount > 0
              ? `${formatINR(withdrawal.totalAmount)} less ${withdrawal.feePercent}% fee (${formatINR(withdrawal.feeAmount)})`
              : withdrawal.source === 'WALLET'
              ? `From ${(BUCKET_LABELS[withdrawal.bucket] || 'wallet').toLowerCase()} · no fee`
              : `${formatINR(withdrawal.principalAmount)} capital + ${formatINR(withdrawal.profitAmount)} profit`}
          </div>
        </div>
      </div>

      <WithdrawalTimeline withdrawal={withdrawal} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Payout to">
          {withdrawal.payoutMethod === 'UPI' ? 'UPI' : 'Bank transfer'}
          <span className="block font-mono text-[11px] text-zinc-500 font-normal break-all">{payoutDestination(withdrawal)}</span>
          {withdrawal.payoutMethod === 'BANK' && withdrawal.payoutAccountHolder && (
            <span className="block text-[11px] text-zinc-500 font-normal">{withdrawal.payoutAccountHolder}</span>
          )}
        </Field>
        <Field label="Payment reference">
          <span className="font-mono">{withdrawal.paymentReference || '—'}</span>
        </Field>
        <Field label="Payment proof">
          {withdrawal.hasPaymentProof ? (
            <button
              type="button"
              onClick={onViewProof}
              disabled={viewDisabled}
              className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View payment proof</span>
            </button>
          ) : (
            <span className="text-zinc-400">—</span>
          )}
        </Field>
      </div>

      {withdrawal.status === 'REJECTED' && (
        <Alert>
          This request was rejected{withdrawal.rejectionReason ? `: ${withdrawal.rejectionReason}` : '.'}{' '}
          {withdrawal.source === 'WALLET'
            ? `${formatINR(withdrawal.totalAmount)} has been returned to your ${(BUCKET_LABELS[withdrawal.bucket] || 'wallet').toLowerCase()}.`
            : 'The investment stays active and keeps earning; contact support if you believe this is a mistake.'}
        </Alert>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Withdrawal request modal
// ---------------------------------------------------------------------------
function availableMethods(details: PayoutDetails | null): PayoutMethod[] {
  if (!details) return [];
  const methods: PayoutMethod[] = [];
  // Withdrawals are paid to the bank account only
  if (details.hasBankDetails) methods.push('BANK');
  return methods;
}

function WithdrawModal({
  token,
  investment,
  onClose,
  onRequested,
  onViewRequests,
}: {
  token: string;
  investment: Investment;
  onClose: () => void;
  onRequested: () => void;
  onViewRequests: () => void;
}) {
  const profileFetcher = useCallback(() => api.getProfile(token), [token]);
  const profile = useAsyncData(profileFetcher);

  const [stage, setStage] = useState<'review' | 'confirm'>('review');
  const [chosenMethod, setChosenMethod] = useState<PayoutMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Withdrawal | null>(null);

  // "Early" only means something for fixed-term plans; open-ended plans are closed whenever the customer likes
  const isEarly = investment.status === 'ACTIVE' && !investment.isOpenEnded;
  const details = profile.data?.payoutDetails || null;
  const methods = availableMethods(details);
  const preferred = details && methods.includes(details.preferredMethod) ? details.preferredMethod : methods[0] || null;
  const method = chosenMethod && methods.includes(chosenMethod) ? chosenMethod : preferred;

  // Display only: the server decides the final amounts. Daily-profit plans have already credited
  // their profit to the profit wallet, so the payout is the capital alone. The fee is charged only
  // when the plan is closed before it ends; matured capital is paid in full.
  const daily = investment.payoutMode === 'DAILY';
  const principal = investment.amount;
  const profit = isEarly || daily ? 0 : investment.expectedProfit;
  const gross = Math.round((principal + profit) * 100) / 100;
  const feeApplies = investment.earlyExitFeeApplies;
  const feePercent = feeApplies ? Number(investment.feePercent) || 0 : 0;
  const fee = Math.round(principal * feePercent) / 100;
  const net = Math.round((gross - fee) * 100) / 100;

  const amountBreakdown = (
    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
      <DetailRow label="Capital" value={<span className="tabular-nums font-semibold">{formatINR(principal)}</span>} />
      {!daily && (
        <DetailRow
          label="Profit"
          value={<span className="tabular-nums font-semibold">{isEarly ? formatINR(0) : `+${formatINR(profit)}`}</span>}
          tone={isEarly ? 'default' : 'profit'}
        />
      )}
      <DetailRow
        label={feeApplies ? `Early withdrawal fee (${feePercent}%)` : 'Fee'}
        value={
          feeApplies ? (
            <span className="tabular-nums font-semibold text-rose-600 dark:text-rose-400">-{formatINR(fee)}</span>
          ) : (
            <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">None</span>
          )
        }
      />
      <DetailRow label="You receive" value={<span className="tabular-nums font-bold">{formatINR(net)}</span>} strong />
    </div>
  );

  const handleSubmit = async () => {
    if (submitting || !method) return;
    setError('');
    setSubmitting(true);
    try {
      const withdrawal = await api.requestWithdrawal(token, investment.id, method);
      setCreated(withdrawal);
      onRequested();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to submit the withdrawal request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const destinationSummary = (
    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
      <DetailRow label="Payout method" value={method === 'UPI' ? 'UPI' : 'Bank transfer'} />
      {method === 'UPI' ? (
        <DetailRow label="UPI ID" value={<span className="font-mono">{details?.upiId || '—'}</span>} />
      ) : (
        <>
          <DetailRow label="Account holder" value={details?.accountHolderName || '—'} />
          <DetailRow label="Account" value={<span className="font-mono">{details?.accountNumberMasked || '—'}</span>} />
          <DetailRow label="IFSC" value={<span className="font-mono">{details?.ifscCode || '—'}</span>} />
          {details?.bankName && <DetailRow label="Bank" value={details.bankName} />}
        </>
      )}
    </div>
  );

  if (created) {
    return (
      <Modal title="Withdrawal requested" onClose={onClose}>
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            Your capital withdrawal of {formatINR(created.totalAmount)} has been submitted.
          </p>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs text-left">
            <DetailRow label="Reference" value={<span className="font-mono">{created.reference}</span>} />
            <DetailRow
              label={`Fee (${created.feePercent}%)`}
              value={<span className="tabular-nums text-rose-600 dark:text-rose-400">-{formatINR(created.feeAmount)}</span>}
            />
            <DetailRow label="You receive" value={<span className="tabular-nums font-bold">{formatINR(created.netAmount)}</span>} strong />
            <DetailRow label="Payout method" value={created.payoutMethod === 'UPI' ? 'UPI' : 'Bank transfer'} />
            <DetailRow label="Requested" value={formatDateTime(created.createdAt)} />
            <DetailRow label="Status" value={<StatusBadge status={created.status} kind="withdrawal" />} />
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed text-left">
            What happens next: an admin reviews and approves the request, then makes the payment to your{' '}
            {created.payoutMethod === 'UPI' ? 'UPI ID' : 'bank account'}. You will be notified at each step and the
            payment reference will appear under &quot;Withdrawal requests&quot;.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className={`${secondaryButtonClass} flex-1`}>
              Close
            </button>
            <button type="button" onClick={onViewRequests} className={`${primaryButtonClass} flex-1`}>
              Track request
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  if (stage === 'confirm' && method) {
    return (
      <Modal
        title="Confirm capital withdrawal"
        description={`${investment.planName} · ${investment.reference}`}
        onClose={onClose}
        closeDisabled={submitting}
      >
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}

          {amountBreakdown}

          {daily && (
            <Alert tone="info">
              {formatINR(investment.profitCredited)} of profit has already been credited to your profit wallet day by
              day and stays there. This request closes the investment and pays out your capital; daily profit on it stops
              now.
            </Alert>
          )}

          {destinationSummary}

          {isEarly && !daily && (
            <Alert tone="warning">
              Early withdrawal: only the capital of {formatINR(principal)} is paid unless the admin sets a profit
              amount on approval. The expected profit of {formatINR(investment.expectedProfit)} is forfeited.
            </Alert>
          )}

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            By confirming, you ask Clyvus Ventures to pay {formatINR(net)} to the payout details shown. The request cannot be
            edited once submitted; an admin reviews it before payment.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStage('review');
              }}
              disabled={submitting}
              className={`${secondaryButtonClass} flex-1`}
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
            <button type="button" onClick={handleSubmit} disabled={submitting} className={`${primaryButtonClass} flex-1`}>
              {submitting && <Spinner />}
              <span>{submitting ? 'Submitting...' : 'Confirm request'}</span>
            </button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Withdraw capital"
      description={`${investment.planName} · ${investment.reference}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        {amountBreakdown}

        {daily && (
          <Alert tone="info">
            Your profit on this plan is credited to your profit wallet every working day ({formatINR(investment.profitCredited)} so
            far) and stays there. Closing the investment pays back your capital
            {feeApplies ? ` less the ${feePercent}% early withdrawal fee` : ' in full'}, and daily profit on it stops.
          </Alert>
        )}

        {isEarly && !daily && (
          <Alert tone="warning">
            This investment has not matured yet (maturity date {formatDate(investment.maturityDate)}). For an early
            withdrawal only the capital is paid, unless the admin decides otherwise when approving the request.
          </Alert>
        )}

        {profile.error && !profile.data ? (
          <ErrorState message={profile.error} onRetry={profile.reload} />
        ) : !profile.data ? (
          <div className="h-24 rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" aria-busy="true" />
        ) : methods.length === 0 ? (
          <div className="space-y-3">
            <Alert tone="warning">
              You have not added your bank account yet. Add it in your profile so we know where to send your money.
            </Alert>
            <Link href="/profile#payout-details" className={`${accentButtonClass} w-full`}>
              <span>Add bank account details</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
          <>
            <fieldset>
              <legend className="text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">Payout destination</legend>
              <div className="space-y-2">
                {methods.map((option) => {
                  const selected = method === option;
                  return (
                    <label
                      key={option}
                      className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition text-xs ${
                        selected
                          ? 'border-blue-600/40 bg-blue-600/5 dark:bg-blue-600/10'
                          : 'border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
                      }`}
                    >
                      <input
                        type="radio"
                        name="payoutMethod"
                        value={option}
                        checked={selected}
                        onChange={() => setChosenMethod(option)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {option === 'BANK' ? 'Bank transfer' : 'UPI'}
                          {details?.preferredMethod === option && (
                            <span className="ml-1.5 text-[10px] font-medium text-zinc-500">(preferred)</span>
                          )}
                        </div>
                        {option === 'BANK' ? (
                          <div className="text-zinc-600 dark:text-zinc-400 mt-0.5 space-y-0.5">
                            <div>{details?.accountHolderName || '—'}</div>
                            <div className="font-mono">
                              {details?.accountNumberMasked || '—'} · {details?.ifscCode || '—'}
                            </div>
                            {details?.bankName && <div>{details.bankName}</div>}
                          </div>
                        ) : (
                          <div className="font-mono text-zinc-600 dark:text-zinc-400 mt-0.5 break-all">{details?.upiId || '—'}</div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
              <p className="text-[11px] text-zinc-500 mt-2">
                Wrong details?{' '}
                <Link href="/profile#payout-details" className="underline">
                  Update them in your profile
                </Link>{' '}
                before requesting.
              </p>
            </fieldset>

            <div className="flex items-center gap-3">
              <button type="button" onClick={onClose} className={`${secondaryButtonClass} flex-1`}>
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setStage('confirm');
                }}
                disabled={!method}
                className={`${primaryButtonClass} flex-1`}
              >
                <span>Continue</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
