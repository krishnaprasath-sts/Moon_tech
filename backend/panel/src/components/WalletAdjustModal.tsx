import React, { useState, useEffect, useId } from 'react';
import { Wallet, Loader2, ArrowDownLeft, ArrowUpRight, Landmark, TrendingUp } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useAdjustWallet } from '../hooks/useFinance';
import { useToast } from '../context/ToastContext';
import { WalletBucket, WalletTxnDirection } from '../types';
import { Field, FormError, inputClass, textareaClass, btnGhostClass, btnSuccessClass, btnDangerClass, labelClass } from './ui';
import { formatINR, getApiErrorMessage, hasMaxTwoDecimals } from '../utils/finance';

interface WalletAdjustModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | string;
  customerName: string;
  capitalBalance: number;
  profitBalance: number;
  onSuccess?: () => void;
}

const BUCKET_LABELS: Record<WalletBucket, string> = {
  CAPITAL: 'Capital wallet',
  PROFIT: 'Profit wallet',
};

export const WalletAdjustModal: React.FC<WalletAdjustModalProps> = ({
  isOpen,
  onClose,
  userId,
  customerName,
  capitalBalance,
  profitBalance,
  onSuccess,
}) => {
  const formId = useId();
  const [direction, setDirection] = useState<WalletTxnDirection>('CREDIT');
  const [bucket, setBucket] = useState<WalletBucket>('PROFIT');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<{ amount?: string; reason?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);

  const { mutateAsync: adjustWallet, isPending } = useAdjustWallet();
  const { toast } = useToast();

  // Reset the form every time the dialog opens
  useEffect(() => {
    if (isOpen) {
      setDirection('CREDIT');
      setBucket('PROFIT');
      setAmount('');
      setReason('');
      setErrors({});
      setFormError(null);
    }
  }, [isOpen]);

  const walletBalance = bucket === 'CAPITAL' ? capitalBalance : profitBalance;
  const value = Number(amount);
  const isAmountValid = amount.trim() !== '' && Number.isFinite(value) && value > 0 && hasMaxTwoDecimals(amount);
  const newBalance = direction === 'CREDIT' ? walletBalance + value : walletBalance - value;

  const validate = () => {
    const next: typeof errors = {};
    if (amount.trim() === '' || !Number.isFinite(value) || value <= 0) next.amount = 'Amount must be greater than 0';
    else if (!hasMaxTwoDecimals(amount)) next.amount = 'Use at most 2 decimal places';
    else if (direction === 'DEBIT' && value > walletBalance) {
      next.amount = `Cannot debit more than the ${BUCKET_LABELS[bucket].toLowerCase()} balance of ${formatINR(walletBalance)}`;
    }
    if (reason.trim().length < 5) next.reason = 'Reason must be at least 5 characters';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setFormError(null);
    if (!validate()) return;

    try {
      await adjustWallet({ userId, data: { direction, bucket, amount: value, reason: reason.trim() } });
      toast.success(
        `${formatINR(value)} ${direction === 'CREDIT' ? 'credited to' : 'debited from'} ${customerName}'s ${BUCKET_LABELS[
          bucket
        ].toLowerCase()}. New balance: ${formatINR(newBalance)}`,
        'Wallet adjusted'
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to adjust the wallet');
      setFormError(msg);
      toast.error(msg);
    }
  };

  const isCredit = direction === 'CREDIT';

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Adjust Wallet"
      subtitle={`${customerName} • Capital ${formatINR(capitalBalance)} • Profit ${formatINR(profitBalance)}`}
      icon={Wallet}
      maxWidthClass="max-w-lg"
      disableClose={isPending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isPending} className={btnGhostClass}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isPending} className={isCredit ? btnSuccessClass : btnDangerClass}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : isCredit ? (
              'Credit Wallet'
            ) : (
              'Debit Wallet'
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormError message={formError} />

        <div>
          <p className={labelClass}>
            Wallet <span className="text-rose-500">*</span>
          </p>
          <div role="radiogroup" aria-label="Wallet" className="grid grid-cols-2 gap-2">
            {(['CAPITAL', 'PROFIT'] as WalletBucket[]).map((option) => {
              const selected = bucket === option;
              const balance = option === 'CAPITAL' ? capitalBalance : profitBalance;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    setBucket(option);
                    setErrors((prev) => ({ ...prev, amount: undefined }));
                  }}
                  className={`text-left px-3 py-2.5 rounded-xl text-xs border transition ${
                    selected
                      ? 'bg-brand-500/10 text-brand-700 dark:text-brand-300 border-brand-500/40'
                      : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <span className="font-bold flex items-center gap-1.5">
                    {option === 'CAPITAL' ? <Landmark className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
                    {BUCKET_LABELS[option]}
                  </span>
                  <span className="block font-mono tabular-nums text-[11px] mt-0.5">{formatINR(balance)}</span>
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5">
            {bucket === 'CAPITAL'
              ? 'Capital can be invested and withdrawn in full at any time, without fee.'
              : 'Profit can be withdrawn by the customer any time without fee.'}
          </p>
        </div>

        <div>
          <p className={labelClass}>
            Direction <span className="text-rose-500">*</span>
          </p>
          <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-2">
            <button
              type="button"
              role="radio"
              aria-checked={isCredit}
              onClick={() => {
                setDirection('CREDIT');
                setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition ${
                isCredit
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                  : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
              Credit (add money)
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={!isCredit}
              onClick={() => {
                setDirection('DEBIT');
                setErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold border transition ${
                !isCredit
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/40'
                  : 'bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
              Debit (remove money)
            </button>
          </div>
        </div>

        <Field label="Amount (₹)" htmlFor={`${formId}-amount`} required error={errors.amount}>
          <input
            id={`${formId}-amount`}
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setErrors((prev) => ({ ...prev, amount: undefined }));
            }}
            placeholder="0.00"
            className={`${inputClass} font-mono font-bold`}
          />
          {isAmountValid && !errors.amount && (
            <p
              className={`text-[11px] mt-1.5 ${
                newBalance < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {BUCKET_LABELS[bucket]} after adjustment: <strong className="font-mono">{formatINR(newBalance)}</strong>
            </p>
          )}
        </Field>

        <Field
          label="Reason"
          htmlFor={`${formId}-reason`}
          required
          error={errors.reason}
          hint="Minimum 5 characters. The adjustment is written to the wallet ledger and the activity log."
        >
          <textarea
            id={`${formId}-reason`}
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setErrors((prev) => ({ ...prev, reason: undefined }));
            }}
            maxLength={500}
            placeholder="e.g. Correction for duplicate payment DEP-..."
            className={textareaClass}
          />
        </Field>
      </form>
    </ModalShell>
  );
};
