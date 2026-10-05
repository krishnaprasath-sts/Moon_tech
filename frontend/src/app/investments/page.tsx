"use client";

import React, { Suspense, useCallback, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, Banknote, Check, CheckCircle2, Eye, Plus, TrendingUp, X } from 'lucide-react';
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
import { formatDate, formatDateTime, formatDuration, formatINR, formatProfit } from '@/lib/format';
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
        subtitle="Track your investments, maturity dates and withdrawal requests."
        actions={
          <Link href="/plans" className={primaryButtonClass}>
            <Plus className="w-3.5 h-3.5" />
            <span>New investment</span>
          </Link>
        }
      />

      <div className="flex items-center gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Investment filters">
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
              description="Once an investment matures you can request a withdrawal. Your requests and their payment status will appear here."
              action={
                <button type="button" onClick={() => changeTab('MATURED')} className={secondaryButtonClass}>
                  View matured investments
                </button>
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
                ? 'Choose an investment plan to put your wallet balance to work.'
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

function InvestmentCard({ investment, onWithdraw }: { investment: Investment; onWithdraw: () => void }) {
  const progress =
    investment.status === 'ACTIVE'
      ? Math.min(100, Math.max(0, Number(investment.progressPercent) || 0))
      : investment.status === 'CANCELLED'
      ? 0
      : 100;
  const daysRemaining = Math.max(0, Number(investment.daysRemaining) || 0);
  const isEarly = investment.status === 'ACTIVE' && investment.earlyWithdrawalAllowed;
  const showProgress = investment.status !== 'CANCELLED';

  return (
    <div className="p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">{investment.planName}</h3>
            <StatusBadge status={investment.status} kind="investment" />
            {isEarly && <StatusBadge status="PENDING" label="Early withdrawal allowed" />}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-0.5">{investment.reference}</div>
        </div>
        {investment.canRequestWithdrawal && (
          <button type="button" onClick={onWithdraw} className={accentButtonClass}>
            <Banknote className="w-3.5 h-3.5" />
            <span>Request withdrawal</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Field label="Amount">
          <span className="tabular-nums font-semibold">{formatINR(investment.amount)}</span>
        </Field>
        <Field label="Expected profit">
          <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">+{formatINR(investment.expectedProfit)}</span>
          <span className="text-zinc-500 font-normal"> ({formatProfit(investment.profitType, investment.profitValue)})</span>
        </Field>
        <Field label="Maturity amount">
          <span className="tabular-nums font-bold">{formatINR(investment.maturityAmount)}</span>
        </Field>
        <Field label="Start date">{formatDate(investment.startDate)}</Field>
        <Field label="Maturity date">{formatDate(investment.maturityDate)}</Field>
        <Field label="Period">{formatDuration(investment.durationDays)}</Field>
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
                ? 'Matured · withdrawal in progress'
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

      {investment.status === 'MATURED' && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          Matured on {formatDate(investment.maturedAt || investment.maturityDate)}.
          {investment.canRequestWithdrawal ? ' You can request your withdrawal now.' : ''}
        </p>
      )}
      {investment.status === 'WITHDRAWAL_REQUESTED' && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400">
          Withdrawal requested. Track it under &quot;Withdrawal requests&quot;.
        </p>
      )}
      {investment.status === 'COMPLETED' && investment.completedAt && (
        <p className="text-[11px] text-zinc-500">Completed on {formatDate(investment.completedAt)}.</p>
      )}
      {investment.status === 'CANCELLED' && (
        <p className="text-[11px] text-zinc-500">
          Cancelled{investment.cancelledAt ? ` on ${formatDate(investment.cancelledAt)}` : ''}
          {investment.cancelReason ? `: ${investment.cancelReason}` : '.'} The principal was refunded to your wallet.
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
            <h3 className="text-sm font-bold text-zinc-950 dark:text-white">{withdrawal.planName}</h3>
            <StatusBadge status={withdrawal.status} kind="withdrawal" />
            {withdrawal.isEarly && <StatusBadge status="PENDING" label="Early withdrawal" />}
          </div>
          <div className="text-[11px] text-zinc-500 font-mono mt-0.5 break-all">
            {withdrawal.reference} · {withdrawal.investmentReference}
          </div>
        </div>
        <div className="sm:text-right shrink-0">
          <div className="tabular-nums font-bold text-base text-zinc-950 dark:text-white">{formatINR(withdrawal.totalAmount)}</div>
          <div className="text-[10px] text-zinc-500 tabular-nums">
            {formatINR(withdrawal.principalAmount)} principal + {formatINR(withdrawal.profitAmount)} profit
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
          This request was rejected{withdrawal.rejectionReason ? `: ${withdrawal.rejectionReason}` : '.'} The investment
          remains in your account; contact support if you believe this is a mistake.
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
  if (details.hasBankDetails) methods.push('BANK');
  if (details.hasUpiDetails) methods.push('UPI');
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

  const isEarly = investment.status === 'ACTIVE';
  const details = profile.data?.payoutDetails || null;
  const methods = availableMethods(details);
  const preferred = details && methods.includes(details.preferredMethod) ? details.preferredMethod : methods[0] || null;
  const method = chosenMethod && methods.includes(chosenMethod) ? chosenMethod : preferred;

  // Display only: the server decides the final amounts.
  const principal = investment.amount;
  const profit = isEarly ? 0 : investment.expectedProfit;

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
            Your withdrawal request for {formatINR(created.totalAmount)} has been submitted.
          </p>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs text-left">
            <DetailRow label="Reference" value={<span className="font-mono">{created.reference}</span>} />
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
        title="Confirm withdrawal request"
        description={`${investment.planName} · ${investment.reference}`}
        onClose={onClose}
        closeDisabled={submitting}
      >
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
            <DetailRow label="Principal" value={<span className="tabular-nums font-semibold">{formatINR(principal)}</span>} />
            <DetailRow
              label="Profit"
              value={<span className="tabular-nums font-semibold">{isEarly ? formatINR(0) : `+${formatINR(profit)}`}</span>}
              tone={isEarly ? 'default' : 'profit'}
            />
            <DetailRow label="Total payout" value={<span className="tabular-nums font-semibold">{formatINR(principal + profit)}</span>} strong />
          </div>

          {destinationSummary}

          {isEarly && (
            <Alert tone="warning">
              Early withdrawal: only the principal of {formatINR(principal)} is paid unless the admin sets a profit
              amount on approval. The expected profit of {formatINR(investment.expectedProfit)} is forfeited.
            </Alert>
          )}

          <p className="text-[11px] text-zinc-500 leading-relaxed">
            By confirming, you ask MoonTech to pay the amount above to the payout details shown. The request cannot be
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
      title="Request withdrawal"
      description={`${investment.planName} · ${investment.reference}`}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
          <DetailRow label="Principal" value={<span className="tabular-nums font-semibold">{formatINR(principal)}</span>} />
          <DetailRow
            label="Profit"
            value={<span className="tabular-nums font-semibold">{isEarly ? formatINR(0) : `+${formatINR(profit)}`}</span>}
            tone={isEarly ? 'default' : 'profit'}
          />
          <DetailRow label="Total payout" value={<span className="tabular-nums font-semibold">{formatINR(principal + profit)}</span>} strong />
        </div>

        {isEarly && (
          <Alert tone="warning">
            This investment has not matured yet (maturity date {formatDate(investment.maturityDate)}). For an early
            withdrawal only the principal is paid, unless the admin decides otherwise when approving the request.
          </Alert>
        )}

        {profile.error && !profile.data ? (
          <ErrorState message={profile.error} onRetry={profile.reload} />
        ) : !profile.data ? (
          <div className="h-24 rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" aria-busy="true" />
        ) : methods.length === 0 ? (
          <div className="space-y-3">
            <Alert tone="warning">
              You have not added any bank or UPI details yet. Add your payout details so we know where to send your
              money.
            </Alert>
            <Link href="/profile#payout-details" className={`${accentButtonClass} w-full`}>
              <span>Add bank / UPI details</span>
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
