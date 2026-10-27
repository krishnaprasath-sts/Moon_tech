"use client";

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Banknote, CheckCircle2, Landmark } from 'lucide-react';
import {
  api,
  getErrorMessage,
  PayoutDetails,
  PayoutMethod,
  WalletBucket,
  WalletConfig,
  WalletSummary,
  Withdrawal,
} from '@/lib/api';
import { useAsyncData } from '@/lib/useAsyncData';
import { accountEnding } from '@/components/profile/BankAccountSection';
import { BUCKET_LABELS, formatDateTime, formatINR, parseAmount } from '@/lib/format';
import {
  accentButtonClass,
  Alert,
  DetailRow,
  ErrorState,
  fieldErrorClass,
  inputClass,
  Modal,
  primaryButtonClass,
  secondaryButtonClass,
  Spinner,
  StatusBadge,
} from '@/components/ui/primitives';

function availableMethods(details: PayoutDetails | null): PayoutMethod[] {
  if (!details) return [];
  const methods: PayoutMethod[] = [];
  if (details.hasBankDetails) methods.push('BANK');
  if (details.hasUpiDetails) methods.push('UPI');
  return methods;
}

/**
 * Withdraw from one of the two wallets to the customer's registered bank account or UPI ID.
 * - Profit wallet: any amount above the minimum, no fee.
 * - Capital wallet: the whole available capital, any time, no fee (only closing a running
 *   investment early carries the fee).
 * The amount is reserved as soon as the request is made and paid manually by an admin after
 * verification; a rejection returns it to the same wallet.
 */
export function WithdrawWalletModal({
  token,
  summary,
  config,
  bucket,
  kycVerified,
  onClose,
  onRequested,
}: {
  token: string;
  summary: WalletSummary;
  config: WalletConfig;
  bucket: WalletBucket;
  kycVerified: boolean;
  onClose: () => void;
  onRequested: () => void;
}) {
  const profileFetcher = useCallback(() => api.getProfile(token), [token]);
  const profile = useAsyncData(profileFetcher);
  const changeRequestsFetcher = useCallback(() => api.getBankChangeRequests(token), [token]);
  const changeRequests = useAsyncData(changeRequestsFetcher);

  const isCapital = bucket === 'CAPITAL';
  const available = isCapital ? summary.capitalBalance : summary.profitBalance;
  const walletLabel = BUCKET_LABELS[bucket].toLowerCase();

  const [stage, setStage] = useState<'form' | 'confirm'>('form');
  const [amountInput, setAmountInput] = useState('');
  const [chosenMethod, setChosenMethod] = useState<PayoutMethod | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<Withdrawal | null>(null);

  const details = profile.data?.payoutDetails || null;
  const methods = availableMethods(details);
  const preferred = details && methods.includes(details.preferredMethod) ? details.preferredMethod : methods[0] || null;
  const method = chosenMethod && methods.includes(chosenMethod) ? chosenMethod : preferred;
  const pendingChange = changeRequests.data?.find((r) => r.status === 'PENDING') || null;
  const ending = accountEnding(details?.accountNumberMasked);
  const paidToLine =
    method === 'BANK' && ending ? (
      <p className="text-xs text-zinc-700 dark:text-zinc-300">
        Paid to:{' '}
        <span className="font-semibold text-zinc-900 dark:text-white">
          {details?.bankName ? `${details.bankName} account` : 'Bank account'} ending {ending}
        </span>
      </p>
    ) : null;
  const pendingChangeNote = pendingChange ? (
    <Alert tone="warning">
      Your change to the account ending {accountEnding(pendingChange.accountNumberMasked)} is still waiting for approval.
      This withdrawal will be paid to your current account{ending ? ` ending ${ending}` : ''}.
    </Alert>
  ) : null;

  // Capital is always withdrawn in full; profit is whatever the customer types
  let validAmount: number | null = null;
  let amountError = '';
  if (isCapital) {
    validAmount = available > 0 ? available : null;
    if (available <= 0) amountError = 'There is no capital in your wallet to withdraw.';
  } else {
    const parsed = parseAmount(amountInput, 'Withdrawal amount');
    amountError = amountInput.trim() ? parsed.error : '';
    if (parsed.value !== null) {
      if (parsed.value < config.minWithdrawal) amountError = `The minimum withdrawal is ${formatINR(config.minWithdrawal)}.`;
      else if (parsed.value > available) amountError = `You can withdraw up to ${formatINR(available)}.`;
    }
    validAmount = parsed.value !== null && !amountError ? parsed.value : null;
  }

  // Wallet withdrawals carry no fee on either bucket; the early withdrawal fee only applies when
  // an investment is closed before it ends (see the investments page).
  const net = validAmount !== null ? validAmount : 0;

  const kycBlocked = config.requireKycForWithdrawal && !kycVerified;
  const canContinue = validAmount !== null && method !== null && !kycBlocked;

  const handleSubmit = async () => {
    if (submitting || validAmount === null || !method) return;
    setError('');
    setSubmitting(true);
    try {
      const withdrawal = await api.requestWalletWithdrawal(token, {
        bucket,
        amount: isCapital ? undefined : validAmount,
        payoutMethod: method,
      });
      setCreated(withdrawal);
      onRequested();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to submit the withdrawal request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const destination = (
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

  const breakdown = (amount: number) => (
    <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
      <DetailRow
        label={isCapital ? 'Capital withdrawn' : 'Withdrawal amount'}
        value={<span className="tabular-nums font-semibold">{formatINR(amount)}</span>}
      />
      <DetailRow label="Fee" value={<span className="tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">None</span>} />
      <DetailRow label="You receive" value={<span className="tabular-nums font-bold">{formatINR(net)}</span>} strong />
      <DetailRow
        label={`${BUCKET_LABELS[bucket]} after`}
        value={<span className="tabular-nums font-semibold">{formatINR(Math.max(0, available - amount))}</span>}
      />
    </div>
  );

  if (created) {
    return (
      <Modal title="Withdrawal requested" onClose={onClose}>
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            Your {walletLabel} withdrawal of {formatINR(created.totalAmount)} has been submitted.
          </p>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs text-left">
            <DetailRow label="Reference" value={<span className="font-mono">{created.reference}</span>} />
            {created.feeAmount > 0 && (
              <DetailRow
                label={`Fee (${created.feePercent}%)`}
                value={<span className="tabular-nums text-rose-600 dark:text-rose-400">-{formatINR(created.feeAmount)}</span>}
              />
            )}
            <DetailRow label="You receive" value={<span className="tabular-nums font-bold">{formatINR(created.netAmount)}</span>} strong />
            <DetailRow label="Payout method" value={created.payoutMethod === 'UPI' ? 'UPI' : 'Bank transfer'} />
            <DetailRow label="Requested" value={formatDateTime(created.createdAt)} />
            <DetailRow label="Status" value={<StatusBadge status={created.status} kind="withdrawal" />} />
          </div>
          <p className="text-[11px] text-zinc-500 leading-relaxed text-left">
            The amount has been reserved from your {walletLabel}. An admin verifies the request, pays it to your{' '}
            {created.payoutMethod === 'UPI' ? 'UPI ID' : 'bank account'} and records the payment reference. If it is
            rejected, the money is returned to your {walletLabel}.
          </p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className={`${secondaryButtonClass} flex-1`}>
              Close
            </button>
            <Link href="/investments?tab=withdrawals" className={`${primaryButtonClass} flex-1`}>
              Track request
            </Link>
          </div>
        </div>
      </Modal>
    );
  }

  if (stage === 'confirm' && validAmount !== null && method) {
    return (
      <Modal
        title={isCapital ? 'Confirm capital withdrawal' : 'Confirm profit withdrawal'}
        description="Review the amount and destination."
        onClose={onClose}
        closeDisabled={submitting}
      >
        <div className="space-y-4">
          {error && <Alert>{error}</Alert>}
          {breakdown(validAmount)}
          {paidToLine}
          {destination}
          {pendingChangeNote}
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            By confirming, you ask Clyvus Ventures to pay {formatINR(net)} to the payout details shown. The amount is reserved
            immediately and the request cannot be edited once submitted.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStage('form');
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
      title={isCapital ? 'Withdraw capital' : 'Withdraw profit'}
      description={
        isCapital
          ? 'Withdraw your available capital to your registered bank account. No fee.'
          : 'Transfer your profit to your registered bank account. No fee.'
      }
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
            {isCapital ? <Landmark className="w-3.5 h-3.5" /> : <Banknote className="w-3.5 h-3.5" />} Available in {walletLabel}
          </span>
          <span className="tabular-nums font-semibold text-zinc-900 dark:text-white">{formatINR(available)}</span>
        </div>

        {kycBlocked && (
          <Alert tone="warning">
            KYC verification is required before you can withdraw.{' '}
            <Link href="/dashboard?kyc=true" className="underline font-semibold">
              Complete your KYC
            </Link>
          </Alert>
        )}

        {isCapital ? (
          <>
            {amountError ? <Alert tone="warning">{amountError}</Alert> : breakdown(validAmount ?? 0)}
            <Alert tone="info">
              Capital is withdrawn in full. Want to keep earning instead?{' '}
              <Link href="/plans" className="underline font-semibold">
                Re-invest it in a plan
              </Link>{' '}
              at no cost.
            </Alert>
          </>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="withdraw-amount" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Amount (₹)
              </label>
              <button
                type="button"
                onClick={() => setAmountInput(String(available))}
                className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Withdraw all
              </button>
            </div>
            <input
              id="withdraw-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder={`e.g. ${config.minWithdrawal}`}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              aria-invalid={Boolean(amountError)}
              aria-describedby={amountError ? 'withdraw-amount-error' : 'withdraw-amount-help'}
              className={`${inputClass} tabular-nums text-sm font-semibold`}
            />
            {amountError ? (
              <p id="withdraw-amount-error" className={fieldErrorClass}>
                {amountError}
              </p>
            ) : (
              <p id="withdraw-amount-help" className="text-[11px] text-zinc-500 mt-1.5">
                Minimum {formatINR(config.minWithdrawal)}, up to your available profit. No fee. Up to 2 decimal places.
              </p>
            )}
          </div>
        )}

        {profile.error && !profile.data ? (
          <ErrorState message={profile.error} onRetry={profile.reload} />
        ) : !profile.data ? (
          <div className="h-24 rounded-xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" aria-busy="true" />
        ) : methods.length === 0 ? (
          <div className="space-y-3">
            <Alert tone="warning">
              You have not added a bank account yet. Add your bank details so we know where to send your money.
            </Alert>
            <Link href="/profile#payout-details" className={`${accentButtonClass} w-full`}>
              <span>Add bank details</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        ) : (
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
                      name="walletPayoutMethod"
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
            {paidToLine && <div className="mt-2">{paidToLine}</div>}
            {pendingChangeNote && <div className="mt-2">{pendingChangeNote}</div>}
            {!pendingChange && (
              <p className="text-[11px] text-zinc-500 mt-2">
                Wrong account?{' '}
                <Link href="/profile#payout-details" className="underline">
                  Request a bank change in your profile
                </Link>
                . Withdrawals go to the current account until the change is approved.
              </p>
            )}
          </fieldset>
        )}

        <button type="submit" disabled={!canContinue} className={`${primaryButtonClass} w-full`}>
          <span>Review withdrawal</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </form>
    </Modal>
  );
}
