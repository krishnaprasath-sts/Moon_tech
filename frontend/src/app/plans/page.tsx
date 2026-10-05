"use client";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, ShieldAlert, TrendingUp, Wallet } from 'lucide-react';
import {
  api,
  getErrorMessage,
  Investment,
  InvestmentPlan,
  InvestmentPreview,
  loginUrl,
  WalletSummary,
} from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import {
  estimateProfit,
  exampleAmount,
  formatDate,
  formatDuration,
  formatINR,
  formatINRShort,
  formatPlanRange,
  formatProfit,
  humanize,
  parseAmount,
} from '@/lib/format';
import {
  accentButtonClass,
  Alert,
  cardClass,
  DetailRow,
  EmptyState,
  ErrorState,
  fieldErrorClass,
  FullPageMessage,
  inputClass,
  Modal,
  PageHeader,
  PageShell,
  primaryButtonClass,
  secondaryButtonClass,
  Spinner,
  StatusBadge,
} from '@/components/ui/primitives';

const PREVIEW_DEBOUNCE_MS = 400;

export default function PlansPage() {
  return (
    <Suspense fallback={<FullPageMessage>Loading plans...</FullPageMessage>}>
      <PlansContent />
    </Suspense>
  );
}

function PlansContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { token, loading: authLoading } = useAuth({ required: false });

  // undefined = untouched (fall back to ?plan=), null = closed by the user
  const [selection, setSelection] = useState<number | null | undefined>(undefined);

  const plans = useAsyncData(api.getInvestmentPlans);

  const walletFetcher = useCallback(() => api.getWallet(token as string), [token]);
  const wallet = useAsyncData(token ? walletFetcher : null);

  const requireKyc = Boolean(wallet.data?.config.requireKycForInvestment);
  const kycFetcher = useCallback(() => api.getKycInfo(token as string), [token]);
  const kyc = useAsyncData(token && requireKyc ? kycFetcher : null);

  const paramPlanId = Number(searchParams.get('plan')) || null;
  const selectedId = selection === undefined ? (token ? paramPlanId : null) : selection;
  const selectedPlan = plans.data?.find((plan) => plan.id === selectedId && plan.isActive) || null;

  const handleInvest = (plan: InvestmentPlan) => {
    if (authLoading || !plan.isActive) return;
    if (!token) {
      router.push(loginUrl(`/plans?plan=${plan.id}`));
      return;
    }
    setSelection(plan.id);
  };

  return (
    <PageShell>
      <PageHeader
        title="Investment plans"
        subtitle="Choose a fixed-term plan, invest from your wallet and receive your principal plus the expected profit at maturity, as per the plan terms."
        actions={
          token ? (
            <Link href="/wallet" className={secondaryButtonClass}>
              <Wallet className="w-3.5 h-3.5" />
              <span>
                Wallet balance: {wallet.data ? formatINR(wallet.data.balance) : wallet.error ? 'unavailable' : '...'}
              </span>
            </Link>
          ) : (
            <Link href={loginUrl('/plans')} className={secondaryButtonClass}>
              Sign in to invest
            </Link>
          )
        }
      />

      {token && requireKyc && kyc.data && kyc.data.status !== 'VERIFIED' && (
        <Alert tone="warning">
          KYC verification is required before you can invest. Your KYC status is{' '}
          <strong>{humanize(kyc.data.status)}</strong>.{' '}
          <Link href="/dashboard?kyc=true" className="underline font-semibold">
            Complete KYC
          </Link>
        </Alert>
      )}

      {plans.error && !plans.data ? (
        <div className={cardClass}>
          <ErrorState message={plans.error} onRetry={plans.reload} />
        </div>
      ) : !plans.data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-80 rounded-2xl bg-zinc-100 dark:bg-zinc-900/20 border border-zinc-200 dark:border-white/[0.05] animate-pulse" />
          ))}
        </div>
      ) : plans.data.length === 0 ? (
        <div className={cardClass}>
          <EmptyState
            icon={<TrendingUp className="w-4 h-4" />}
            title="No plans available right now"
            description="There are no active investment plans at the moment. Please check back soon."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {plans.data.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onInvest={() => handleInvest(plan)} isAuthenticated={Boolean(token)} />
          ))}
        </div>
      )}

      <p className="text-[11px] text-zinc-500 leading-relaxed">
        Profit and maturity dates are calculated by MoonTech when you confirm an investment. Amounts shown before
        confirmation are estimates. Investments carry risk; the profit shown is the expected amount as per the plan
        terms.
      </p>

      {selectedPlan && token && (
        <InvestModal
          key={selectedPlan.id}
          token={token}
          plan={selectedPlan}
          wallet={wallet.data}
          walletError={wallet.error}
          walletLoading={wallet.loading}
          kycStatus={requireKyc ? kyc.data?.status || null : 'NOT_REQUIRED'}
          kycLoading={requireKyc && kyc.loading}
          onInvested={wallet.reload}
          onClose={() => setSelection(null)}
        />
      )}
    </PageShell>
  );
}

function PlanCard({
  plan,
  onInvest,
  isAuthenticated,
}: {
  plan: InvestmentPlan;
  onInvest: () => void;
  isAuthenticated: boolean;
}) {
  const example = exampleAmount(plan);
  const exampleProfit = estimateProfit(plan, example);
  const available = plan.isActive;

  return (
    <div
      className={`p-6 rounded-2xl bg-white dark:bg-zinc-900/30 border border-zinc-200/90 dark:border-white/[0.07] hover:border-zinc-300 dark:hover:border-white/[0.16] transition duration-200 flex flex-col justify-between shadow-xs ${
        available ? '' : 'opacity-70'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-zinc-950 dark:text-white text-base leading-snug">{plan.name}</h2>
              {plan.isFeatured && available && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded">
                  Featured
                </span>
              )}
              {!available && <StatusBadge status="NOT_AVAILABLE" label="Not available" />}
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{formatDuration(plan.durationDays)} term</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatProfit(plan.profitType, plan.profitValue)}
            </div>
            <div className="text-[10px] text-zinc-500">{plan.profitType === 'FIXED' ? 'expected profit at maturity' : 'expected profit over the term'}</div>
          </div>
        </div>

        {plan.description && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">{plan.description}</p>
        )}

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
            <span className="text-zinc-700 dark:text-zinc-300 text-right">Principal + profit at maturity</span>
          </div>
        </div>

        <p className="mt-3.5 p-3 rounded-xl bg-emerald-500/[0.06] border border-emerald-500/15 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
          <span className="text-zinc-500">Example: </span>
          <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">{formatINRShort(example)}</span> becomes{' '}
          <span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{formatINRShort(example + exampleProfit)}</span> in{' '}
          {formatDuration(plan.durationDays)}.
        </p>
      </div>

      <button
        type="button"
        onClick={onInvest}
        disabled={!available}
        className="mt-5 w-full py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 hover:opacity-90 disabled:opacity-50 font-semibold text-xs text-center transition active:scale-98"
      >
        {!available ? 'Not available right now' : isAuthenticated ? 'Invest in this plan' : 'Sign in to invest'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invest modal
// ---------------------------------------------------------------------------
interface PreviewResult {
  amount: number;
  preview: InvestmentPreview | null;
  error: string;
}

function InvestModal({
  token,
  plan,
  wallet,
  walletError,
  walletLoading,
  kycStatus,
  kycLoading,
  onInvested,
  onClose,
}: {
  token: string;
  plan: InvestmentPlan;
  wallet: WalletSummary | null;
  walletError: string;
  walletLoading: boolean;
  /** 'NOT_REQUIRED' when KYC is optional, null while unknown. */
  kycStatus: string | null;
  kycLoading: boolean;
  onInvested: () => void;
  onClose: () => void;
}) {
  const [amountInput, setAmountInput] = useState(String(plan.minAmount));
  const [stage, setStage] = useState<'form' | 'confirm'>('form');
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [investment, setInvestment] = useState<Investment | null>(null);

  const balance = wallet?.balance ?? null;
  const kycBlocked = kycStatus !== 'NOT_REQUIRED' && kycStatus !== 'VERIFIED';

  // Client-side validation (display only: the server validates again)
  const parsed = parseAmount(amountInput, 'Investment amount');
  let amountError = parsed.error;
  if (parsed.value !== null) {
    if (parsed.value < plan.minAmount) amountError = `The minimum for this plan is ${formatINR(plan.minAmount)}.`;
    else if (parsed.value > plan.maxAmount) amountError = `The maximum for this plan is ${formatINR(plan.maxAmount)}.`;
  }
  const validAmount = amountError ? null : parsed.value;
  const insufficient = validAmount !== null && balance !== null && validAmount > balance;

  // Debounced server preview; the cleanup flag discards out-of-order responses.
  useEffect(() => {
    if (validAmount === null || kycBlocked) return;
    let active = true;
    const timer = setTimeout(() => {
      api
        .previewInvestment(token, plan.id, validAmount)
        .then((preview) => {
          if (active) setResult({ amount: validAmount, preview, error: '' });
        })
        .catch((err: unknown) => {
          if (active) {
            setResult({ amount: validAmount, preview: null, error: getErrorMessage(err, 'Unable to calculate the preview.') });
          }
        });
    }, PREVIEW_DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [token, plan.id, validAmount, kycBlocked]);

  const current = result && result.amount === validAmount ? result : null;
  const preview = current?.preview || null;
  const previewLoading = validAmount !== null && !current;

  const canContinue =
    validAmount !== null && preview !== null && balance !== null && !insufficient && !kycBlocked;

  const handleConfirm = async () => {
    if (submitting || validAmount === null) return;
    setError('');
    setSubmitting(true);
    try {
      const created = await api.createInvestment(token, plan.id, validAmount);
      setInvestment(created);
      onInvested();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to create the investment. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (investment) {
    return (
      <Modal title="Investment confirmed" onClose={onClose}>
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            You invested {formatINR(investment.amount)} in {investment.planName}.
          </p>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs text-left">
            <DetailRow label="Investment ID" value={<span className="font-mono">{investment.reference}</span>} />
            <DetailRow label="Expected profit" value={<span className="tabular-nums font-semibold">+{formatINR(investment.expectedProfit)}</span>} tone="profit" />
            <DetailRow label="Maturity amount" value={<span className="tabular-nums font-bold">{formatINR(investment.maturityAmount)}</span>} strong />
            <DetailRow label="Maturity date" value={formatDate(investment.maturityDate)} />
            <DetailRow label="Status" value={<StatusBadge status={investment.status} kind="investment" />} />
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed text-left">
            What happens next: your investment runs until the maturity date. You will be notified when it matures, and
            you can then request a withdrawal of the principal and profit to your bank account or UPI.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className={`${secondaryButtonClass} flex-1`}>
              Close
            </button>
            <Link href="/investments" className={`${primaryButtonClass} flex-1`}>
              <span>View my investments</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </Modal>
    );
  }

  if (kycLoading) {
    return (
      <Modal title={`Invest in ${plan.name}`} onClose={onClose}>
        <div className="h-32 rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" aria-busy="true" />
      </Modal>
    );
  }

  if (kycBlocked) {
    return (
      <Modal title="KYC verification required" onClose={onClose}>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Investments are open to KYC-verified customers only.
              {kycStatus ? (
                <>
                  {' '}Your KYC status is <strong className="text-zinc-900 dark:text-white">{humanize(kycStatus)}</strong>.
                </>
              ) : (
                ' We could not confirm your KYC status.'
              )}{' '}
              {kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW'
                ? 'Your documents are being reviewed. You can invest as soon as they are approved.'
                : 'Submit your identity documents to start investing.'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className={`${secondaryButtonClass} flex-1`}>
              Not now
            </button>
            <Link href="/dashboard?kyc=true" className={`${accentButtonClass} flex-1`}>
              {kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW' ? 'View KYC status' : 'Complete KYC'}
            </Link>
          </div>
        </div>
      </Modal>
    );
  }

  if (stage === 'confirm' && preview && validAmount !== null) {
    return (
      <Modal
        title="Confirm your investment"
        description="Please review the details. The amount is debited from your wallet as soon as you confirm."
        onClose={onClose}
        closeDisabled={submitting}
      >
        {error && <Alert className="mb-4">{error}</Alert>}
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
          <DetailRow label="Plan" value={preview.planName} />
          <DetailRow label="Investment amount" value={<span className="tabular-nums font-bold">{formatINR(preview.amount)}</span>} strong />
          <DetailRow label="Profit" value={formatProfit(preview.profitType, preview.profitValue)} />
          <DetailRow label="Investment period" value={formatDuration(preview.durationDays)} />
          <DetailRow label="Expected profit" value={<span className="tabular-nums font-semibold">+{formatINR(preview.expectedProfit)}</span>} tone="profit" />
          <DetailRow label="Maturity amount" value={<span className="tabular-nums font-bold">{formatINR(preview.maturityAmount)}</span>} strong />
          <DetailRow label="Maturity date" value={formatDate(preview.maturityDate)} />
          {balance !== null && (
            <DetailRow
              label="Wallet balance after"
              value={<span className="tabular-nums font-semibold">{formatINR(balance - preview.amount)}</span>}
            />
          )}
        </div>
        <p className="text-[11px] text-zinc-500 leading-relaxed mt-3">
          The investment stays locked until the maturity date. You can request a withdrawal after it matures. The profit
          shown is the expected amount as per the plan terms.
        </p>
        <div className="flex items-center gap-3 mt-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => {
              setError('');
              setStage('form');
            }}
            className={`${secondaryButtonClass} flex-1`}
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Back</span>
          </button>
          <button type="button" disabled={submitting} onClick={handleConfirm} className={`${primaryButtonClass} flex-1`}>
            {submitting && <Spinner />}
            <span>{submitting ? 'Investing...' : `Confirm and invest ${formatINR(preview.amount)}`}</span>
          </button>
        </div>
      </Modal>
    );
  }

  const estimatedProfit = validAmount !== null ? estimateProfit(plan, validAmount) : 0;

  return (
    <Modal
      title={`Invest in ${plan.name}`}
      description={`${formatProfit(plan.profitType, plan.profitValue)} expected profit over ${formatDuration(plan.durationDays)}.`}
      onClose={onClose}
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (canContinue) setStage('confirm');
        }}
      >
        <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs flex items-center justify-between gap-3">
          <span className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5" /> Wallet balance
          </span>
          <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">
            {balance !== null ? formatINR(balance) : walletLoading ? 'Loading...' : 'Unavailable'}
          </span>
        </div>
        {walletError && balance === null && <Alert>{walletError}</Alert>}

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor="invest-amount" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Investment amount (₹)
            </label>
            <span className="text-[11px] text-zinc-500 tabular-nums font-medium">{formatPlanRange(plan)}</span>
          </div>
          <input
            id="invest-amount"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={amountInput}
            onChange={(e) => setAmountInput(e.target.value)}
            aria-invalid={Boolean(amountError)}
            aria-describedby={amountError ? 'invest-amount-error' : 'invest-amount-help'}
            className={`${inputClass} tabular-nums text-sm font-semibold`}
          />
          {amountError ? (
            <p id="invest-amount-error" className={fieldErrorClass}>
              {amountError}
            </p>
          ) : (
            <p id="invest-amount-help" className="text-[11px] text-zinc-500 mt-1.5">
              Between {formatINR(plan.minAmount)} and {formatINR(plan.maxAmount)}, up to 2 decimal places.
            </p>
          )}
        </div>

        {insufficient && balance !== null && validAmount !== null && (
          <Alert tone="warning">
            Your wallet balance is {formatINR(validAmount - balance)} short for this amount.{' '}
            <Link href="/wallet" className="underline font-semibold">
              Add money to your wallet
            </Link>
          </Alert>
        )}

        {validAmount !== null && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
            {current?.error ? (
              <Alert>{current.error}</Alert>
            ) : (
              <div className={previewLoading ? 'opacity-60' : ''} aria-busy={previewLoading}>
                <DetailRow
                  label="Expected profit"
                  value={<span className="tabular-nums font-semibold">+{formatINR(preview ? preview.expectedProfit : estimatedProfit)}</span>}
                  tone="profit"
                />
                <DetailRow
                  label="Maturity amount"
                  value={
                    <span className="tabular-nums font-bold">
                      {formatINR(preview ? preview.maturityAmount : validAmount + estimatedProfit)}
                    </span>
                  }
                  strong
                />
                <DetailRow
                  label="Maturity date"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="w-3 h-3 text-zinc-400" />
                      {preview ? formatDate(preview.maturityDate) : 'Calculating...'}
                    </span>
                  }
                />
                {previewLoading && <p className="text-[10px] text-zinc-500 pt-1">Estimate shown. Confirming with the server...</p>}
              </div>
            )}
          </div>
        )}

        <button type="submit" disabled={!canContinue} className={`${primaryButtonClass} w-full`}>
          <span>Review investment</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </form>
    </Modal>
  );
}
