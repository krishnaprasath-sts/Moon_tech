'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, Copy, FileText, Landmark, Trash2, UploadCloud } from 'lucide-react';
import { api, Deposit, DepositMethod, getErrorMessage, WalletConfig } from '@/lib/api';
import { formatDateTime, formatFileSize, formatINR, formatINRShort, parseAmount, validateReceiptFile } from '@/lib/format';
import {
  Alert,
  DetailRow,
  fieldErrorClass,
  inputClass,
  labelClass,
  Modal,
  primaryButtonClass,
  RequiredMark,
  secondaryButtonClass,
  Spinner,
  StatusBadge,
} from '@/components/ui/primitives';

const UTR_PATTERN = /^[A-Za-z0-9]{8,35}$/;
const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 25000, 50000];

type Step = 1 | 2 | 3;

const STEP_LABELS = ['Amount', 'Transfer to bank', 'Submit proof'];

export const DEPOSIT_METHOD_LABELS: Record<DepositMethod, string> = {
  UPI: 'UPI (discontinued)',
  BANK_TRANSFER: 'Bank transfer',
};

/**
 * Three-step "Add money" flow, bank transfer only: choose the amount, transfer it to the
 * company bank account (NEFT / IMPS / RTGS), then submit the UTR and the receipt.
 */
export function AddMoneyModal({
  token,
  config,
  onClose,
  onCreated,
}: {
  token: string;
  config: WalletConfig;
  onClose: () => void;
  onCreated: () => void;
}) {
  const bankAvailable = Boolean(config.bankTransferEnabled);
  const [step, setStep] = useState<Step>(1);
  const [amountInput, setAmountInput] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [utr, setUtr] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Deposit | null>(null);

  const parsed = useMemo(() => parseAmount(amountInput), [amountInput]);
  const amountProblem =
    amountInput.trim() === ''
      ? ''
      : parsed.value === null
      ? parsed.error
      : parsed.value < config.minTopup
      ? `Minimum top-up is ${formatINR(config.minTopup)}.`
      : parsed.value > config.maxTopup
      ? `Maximum top-up is ${formatINR(config.maxTopup)}.`
      : '';

  // Thumbnail for image receipts; the object URL is released when the file changes or the modal closes
  const preview = useMemo(() => (receipt && receipt.type.startsWith('image/') ? URL.createObjectURL(receipt) : ''), [receipt]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const handleAmountSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (parsed.value === null) {
      setError(parsed.error || 'Enter the amount you will transfer.');
      return;
    }
    if (amountProblem) {
      setError(amountProblem);
      return;
    }
    setError('');
    setAmount(parsed.value);
    setStep(2);
  };

  const handleFile = (file: File | null) => {
    if (!file) return;
    const problem = validateReceiptFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    setError('');
    setReceipt(file);
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || amount === null) return;
    const cleanUtr = utr.trim();
    if (!UTR_PATTERN.test(cleanUtr)) {
      setError('Bank transfer reference (UTR) must be 8 to 35 letters or digits, without spaces.');
      return;
    }
    if (!receipt) {
      setError('Please upload your transfer screenshot or receipt.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const deposit = await api.createDeposit(token, { amount, paymentMethod: 'BANK_TRANSFER', upiTransactionId: cleanUtr, receipt });
      setCreated(deposit);
      onCreated();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to submit your deposit. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    return (
      <Modal title="Transfer submitted" onClose={onClose} width="max-w-lg">
        <div className="text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" aria-hidden="true" />
          </div>
          <div>
            <p className="text-base font-bold text-zinc-900 dark:text-white">{formatINR(created.amount)} is under verification</p>
            <p className="text-xs text-zinc-500 mt-1">We will credit your wallet as soon as an admin confirms the transfer.</p>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs text-left">
            <DetailRow label="Reference" value={<span className="font-mono">{created.reference}</span>} />
            <DetailRow label="Paid via" value={DEPOSIT_METHOD_LABELS[created.paymentMethod] || created.paymentMethod} />
            <DetailRow label="UTR" value={<span className="font-mono">{created.upiTransactionId}</span>} />
            <DetailRow label="Submitted" value={formatDateTime(created.createdAt)} />
            <DetailRow label="Status" value={<StatusBadge status={created.status} kind="deposit" />} />
          </div>
          <ol className="text-left text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
            <TimelineItem n={1} active>
              An admin matches your UTR and receipt against the money received in the bank account.
            </TimelineItem>
            <TimelineItem n={2}>{formatINR(created.amount)} is added to your capital wallet once approved.</TimelineItem>
            <TimelineItem n={3}>You get a notification either way. Rejections show the reason under Deposits.</TimelineItem>
          </ol>
          <button type="button" onClick={onClose} className={`${primaryButtonClass} w-full`}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Add money to wallet"
      description={
        step === 1
          ? 'Enter the amount you will transfer from your bank.'
          : step === 2
          ? 'Transfer the exact amount to our bank account, then continue.'
          : 'Tell us the UTR and attach your receipt so we can verify the transfer.'
      }
      onClose={onClose}
      closeDisabled={submitting}
      width="max-w-lg"
    >
      {/* Step indicator */}
      <ol className="flex items-center gap-2 mb-5" aria-label="Add money steps">
        {STEP_LABELS.map((label, index) => {
          const number = (index + 1) as Step;
          const state = number < step ? 'done' : number === step ? 'current' : 'upcoming';
          return (
            <li key={label} className="flex-1 min-w-0" aria-current={state === 'current' ? 'step' : undefined}>
              <div
                className={`h-1 rounded-full mb-1.5 ${
                  state === 'done' ? 'bg-emerald-500' : state === 'current' ? 'bg-blue-600' : 'bg-zinc-200 dark:bg-white/10'
                }`}
              />
              <div
                className={`text-[11px] font-semibold truncate flex items-center gap-1 ${
                  state === 'current'
                    ? 'text-blue-700 dark:text-blue-300'
                    : state === 'done'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-zinc-400'
                }`}
              >
                {state === 'done' ? <Check className="w-3 h-3 shrink-0" aria-label="Completed" /> : <span>{number}.</span>}
                <span className="truncate">{label}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {error && <Alert className="mb-4">{error}</Alert>}

      {/* Step 1: amount */}
      {step === 1 && (
        <form onSubmit={handleAmountSubmit} className="space-y-5" noValidate>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="topup-amount" className={labelClass.replace('mb-1.5', '')}>
                Amount<RequiredMark />
              </label>
              <span className="text-[11px] text-zinc-500 tabular-nums">
                {formatINRShort(config.minTopup)} – {formatINRShort(config.maxTopup)}
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-semibold text-zinc-400 select-none">₹</span>
              <input
                id="topup-amount"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                placeholder={String(config.minTopup)}
                value={amountInput}
                onChange={(e) => {
                  setAmountInput(e.target.value);
                  setError('');
                }}
                aria-invalid={Boolean(amountProblem)}
                aria-describedby="topup-amount-help"
                className={`${inputClass} !pl-8 !py-3 tabular-nums !text-xl font-bold`}
              />
            </div>
            <p id="topup-amount-help" className={amountProblem ? fieldErrorClass : 'text-[11px] text-zinc-500 mt-1.5'}>
              {amountProblem || 'Enter the exact amount you will transfer. Up to 2 decimal places.'}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-2.5" aria-label="Quick amounts">
              {QUICK_AMOUNTS.filter((v) => v >= config.minTopup && v <= config.maxTopup).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    setAmountInput(String(v));
                    setError('');
                  }}
                  className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold tabular-nums transition ${
                    parsed.value === v
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 hover:border-zinc-400 dark:hover:border-white/30'
                  }`}
                >
                  {formatINRShort(v)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-white/10 p-3 flex items-start gap-3 text-xs">
            <span className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Landmark className="w-4 h-4" />
            </span>
            <div className="min-w-0">
              <div className="font-semibold text-zinc-900 dark:text-white">Bank transfer (NEFT, IMPS or RTGS)</div>
              <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                {bankAvailable
                  ? 'Transfer from your bank app or net banking to our company account shown on the next step.'
                  : 'Bank transfer details are not available right now. Please try again later.'}
              </p>
            </div>
          </div>

          <button type="submit" disabled={!bankAvailable || Boolean(amountProblem) || amountInput.trim() === ''} className={`${primaryButtonClass} w-full`}>
            <span>Continue to bank details</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      )}

      {/* Step 2: transfer */}
      {step === 2 && amount !== null && (
        <div className="space-y-4">
          <div className="rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">Amount to transfer</div>
              <div className="text-2xl font-bold tabular-nums">{formatINR(amount)}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">Via</div>
              <div className="text-sm font-semibold inline-flex items-center gap-1.5">
                <Landmark className="w-3.5 h-3.5" />
                Bank transfer
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] divide-y divide-zinc-100 dark:divide-white/[0.06] text-xs">
            <CopyRow label="Account holder" value={config.bankAccountName} />
            <CopyRow label="Account number" value={config.bankAccountNumber} mono />
            <CopyRow label="IFSC code" value={config.bankIfsc} mono />
            <CopyRow label="Bank" value={config.bankName} copy={false} />
            {config.bankBranch && <CopyRow label="Branch" value={config.bankBranch} copy={false} />}
            <CopyRow label="Amount" value={amount.toFixed(2)} display={formatINR(amount)} />
          </div>
          <div className="rounded-xl bg-blue-500/[0.06] border border-blue-500/15 p-3 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed space-y-1">
            <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" /> How to transfer
            </div>
            <ol className="list-decimal pl-4 space-y-0.5">
              <li>Add the account above as a beneficiary in your bank app or net banking (IMPS works instantly, NEFT may take up to 2 hours).</li>
              <li>Transfer exactly {formatINR(amount)}. Put your registered mobile number in the remarks if your bank allows it.</li>
              <li>
                <b>Note the UTR / transaction reference from the confirmation and take a screenshot.</b>
              </li>
            </ol>
          </div>
          {config.bankTransferInstructions && <Note>{config.bankTransferInstructions}</Note>}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep(1);
              }}
              className={`${secondaryButtonClass} flex-1`}
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setStep(3);
              }}
              className={`${primaryButtonClass} flex-1`}
            >
              <span>I have transferred</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: proof */}
      {step === 3 && amount !== null && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
            <DetailRow label="Amount transferred" value={<span className="tabular-nums font-semibold">{formatINR(amount)}</span>} strong />
            <DetailRow label="Paid to" value={<span className="font-mono break-all">{`${config.bankAccountNumber} (${config.bankIfsc})`}</span>} />
          </div>

          <div>
            <label htmlFor="topup-utr" className={labelClass}>
              Transfer reference / UTR number
              <RequiredMark />
            </label>
            <input
              id="topup-utr"
              type="text"
              autoComplete="off"
              autoFocus
              maxLength={35}
              placeholder="e.g. N123456789012345 or 412345678901"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\s+/g, '').toUpperCase())}
              disabled={submitting}
              aria-invalid={utr.length > 0 && !UTR_PATTERN.test(utr)}
              aria-describedby="topup-utr-help"
              className={`${inputClass} font-mono tracking-wider`}
            />
            <p id="topup-utr-help" className={utr.length > 0 && !UTR_PATTERN.test(utr) ? fieldErrorClass : 'text-[11px] text-zinc-500 mt-1.5'}>
              8 to 35 letters or digits. Shown in your bank app or statement as UTR, RRN or transaction reference.
            </p>
          </div>

          <div>
            <span className={labelClass}>
              Transfer screenshot or receipt<RequiredMark />
            </span>
            {receipt ? (
              <div className="p-2.5 rounded-xl bg-blue-600/5 dark:bg-blue-600/10 border border-blue-600/30 flex items-center gap-3">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Receipt preview" className="w-12 h-12 rounded-lg object-cover border border-zinc-200 dark:border-white/10 shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-zinc-500" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-zinc-900 dark:text-white" title={receipt.name}>
                    {receipt.name}
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono">{formatFileSize(receipt.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setReceipt(null)}
                  disabled={submitting}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition disabled:opacity-50"
                  aria-label="Remove receipt"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label
                className="block text-center py-5 px-3 cursor-pointer rounded-xl border-2 border-dashed border-zinc-300 dark:border-white/15 hover:border-blue-600 dark:hover:border-blue-500 hover:bg-blue-500/[0.03] transition focus-within:border-blue-600"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  handleFile(e.dataTransfer.files?.[0] || null);
                }}
              >
                <UploadCloud className="w-7 h-7 mx-auto mb-1.5 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Tap to upload or drag a file here</span>
                <span className="text-[10px] text-zinc-400 block mt-0.5">JPEG, PNG, WEBP or PDF, up to 5 MB</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  disabled={submitting}
                  onChange={(e) => {
                    handleFile(e.target.files?.[0] || null);
                    e.target.value = '';
                  }}
                  className="sr-only"
                />
              </label>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={submitting}
              onClick={() => {
                setError('');
                setStep(2);
              }}
              className={`${secondaryButtonClass} flex-1`}
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back</span>
            </button>
            <button type="submit" disabled={submitting || !receipt || !UTR_PATTERN.test(utr)} className={`${primaryButtonClass} flex-1`}>
              {submitting && <Spinner />}
              <span>{submitting ? 'Submitting...' : 'Submit for verification'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function CopyRow({ label, value, display, mono, copy = true }: { label: string; value: string; display?: string; mono?: boolean; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable: value is select-all */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</div>
        <div className={`text-zinc-900 dark:text-white font-semibold break-all select-all ${mono ? 'font-mono' : ''}`}>{display || value || '—'}</div>
      </div>
      {copy && value && (
        <button
          type="button"
          onClick={doCopy}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-200 dark:border-white/10 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0"
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      )}
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">{children}</p>;
}

function TimelineItem({ n, active, children }: { n: number; active?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
          active ? 'bg-blue-600 text-white' : 'bg-zinc-100 dark:bg-white/10 text-zinc-500'
        }`}
      >
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
