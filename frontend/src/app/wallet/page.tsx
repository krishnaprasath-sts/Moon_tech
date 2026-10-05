"use client";

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  FileText,
  Plus,
  Smartphone,
  Trash2,
  TrendingUp,
  UploadCloud,
  Wallet as WalletIcon,
} from 'lucide-react';
import { api, Deposit, DepositStatus, getErrorMessage, WalletConfig } from '@/lib/api';
import { useAuth } from '@/lib/useAuth';
import { useAsyncData } from '@/lib/useAsyncData';
import {
  formatDateTime,
  formatFileSize,
  formatINR,
  formatINRShort,
  parseAmount,
  validateReceiptFile,
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
  fieldErrorClass,
  FullPageMessage,
  inputClass,
  labelClass,
  LoadingRows,
  Modal,
  PageHeader,
  PageShell,
  Pagination,
  primaryButtonClass,
  RequiredMark,
  secondaryButtonClass,
  Spinner,
  StatusBadge,
} from '@/components/ui/primitives';
import { useFileViewer } from '@/components/ui/FileViewer';

const PAGE_SIZE = 10;
const UTR_PATTERN = /^[A-Za-z0-9]{8,35}$/;

const STATUS_FILTERS: { value: DepositStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
];

export default function WalletPage() {
  const { token, loading: authLoading } = useAuth();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<DepositStatus | ''>('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const viewer = useFileViewer();

  const walletFetcher = useCallback(() => api.getWallet(token as string), [token]);
  const depositsFetcher = useCallback(
    () => api.getDeposits(token as string, { page, limit: PAGE_SIZE, status }),
    [token, page, status]
  );

  const wallet = useAsyncData(token ? walletFetcher : null);
  const deposits = useAsyncData(token ? depositsFetcher : null);

  if (authLoading || !token) return <FullPageMessage>Loading wallet...</FullPageMessage>;

  const summary = wallet.data;
  const config = summary?.config;

  const handleDepositCreated = () => {
    wallet.reload();
    if (page === 1 && (status === '' || status === 'PENDING')) deposits.reload();
    else {
      setStatus('');
      setPage(1);
    }
  };

  const changeStatus = (next: DepositStatus | '') => {
    setStatus(next);
    setPage(1);
  };

  const addMoneyButton = (className: string) => (
    <button type="button" onClick={() => setIsAddOpen(true)} disabled={!config} className={className}>
      <Plus className="w-3.5 h-3.5" />
      <span>Add money</span>
    </button>
  );

  return (
    <PageShell>
      <PageHeader
        title="Wallet"
        subtitle="Add money by UPI, upload your payment receipt and track verification."
        actions={addMoneyButton(primaryButtonClass)}
      />

      {wallet.error && !summary ? (
        <div className={cardClass}>
          <ErrorState message={wallet.error} onRetry={wallet.reload} />
        </div>
      ) : !summary ? (
        <div className="h-48 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" aria-busy="true" />
      ) : (
        <>
          {wallet.error && <Alert>{wallet.error}</Alert>}

          {/* Balance hero */}
          <div className={`p-6 ${cardClass}`}>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-5">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  <WalletIcon className="w-4 h-4 text-blue-600" />
                  Available balance
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-zinc-950 dark:text-white tabular-nums tracking-tight mt-1 break-words">
                  {formatINR(summary.balance)}
                </div>
                <p className="text-[11px] text-zinc-500 mt-1">Ready to invest in any plan.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {addMoneyButton(accentButtonClass)}
                <Link href="/plans" className={secondaryButtonClass}>
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Invest</span>
                </Link>
              </div>
            </div>

            <dl className="mt-5 pt-4 border-t border-zinc-100 dark:border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Pending verification
                </dt>
                <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                  {formatINR(summary.pendingDepositAmount)}
                  <span className="font-normal text-zinc-500">
                    {' '}
                    · {summary.pendingDepositCount} payment{summary.pendingDepositCount === 1 ? '' : 's'}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Total deposited</dt>
                <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">{formatINR(summary.totalDeposited)}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                  <Smartphone className="w-3.5 h-3.5 text-zinc-400" /> Top-up limits
                </dt>
                <dd className="font-semibold text-zinc-900 dark:text-white tabular-nums mt-0.5">
                  {formatINRShort(summary.config.minTopup)} – {formatINRShort(summary.config.maxTopup)}
                </dd>
              </div>
            </dl>
          </div>

          {summary.pendingDepositCount > 0 ? (
            <Alert tone="warning">
              <strong>{formatINR(summary.pendingDepositAmount)}</strong> across {summary.pendingDepositCount} payment
              {summary.pendingDepositCount === 1 ? '' : 's'} is awaiting admin verification. It is added to your balance
              as soon as the receipt is approved; you will get a notification either way.
            </Alert>
          ) : (
            <Alert tone="info">
              Your wallet is credited only after an admin verifies your payment receipt. Pending amounts are not
              available to invest until then.
            </Alert>
          )}
        </>
      )}

      {/* Deposit history */}
      <div className={`${cardClass} overflow-hidden`}>
        <CardHeader icon={<FileText />} title="Deposit history" />

        <div className="px-5 py-3 border-b border-zinc-100 dark:border-white/[0.06] flex items-center gap-2 overflow-x-auto" role="tablist" aria-label="Filter deposits by status">
          {STATUS_FILTERS.map((option) => (
            <button
              key={option.label}
              type="button"
              role="tab"
              aria-selected={status === option.value}
              onClick={() => changeStatus(option.value)}
              className={chipClass(status === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        {deposits.error && !deposits.data ? (
          <ErrorState message={deposits.error} onRetry={deposits.reload} />
        ) : !deposits.data ? (
          <LoadingRows />
        ) : deposits.data.items.length === 0 ? (
          <EmptyState
            icon={<WalletIcon className="w-4 h-4" />}
            title={status ? `No ${status.toLowerCase()} deposits` : 'No deposits yet'}
            description={
              status
                ? 'Deposits with this status will appear here.'
                : 'Add money to your wallet by UPI. Your deposit requests and their verification status will appear here.'
            }
            action={status ? undefined : addMoneyButton(accentButtonClass)}
          />
        ) : (
          <>
            {deposits.error && <Alert className="m-4">{deposits.error}</Alert>}
            <div className={`overflow-x-auto transition-opacity ${deposits.loading ? 'opacity-60' : ''}`} aria-busy={deposits.loading}>
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/40 text-zinc-500 dark:text-zinc-400 font-medium border-b border-zinc-100 dark:border-white/[0.04]">
                  <tr>
                    <th scope="col" className="py-3 px-5">Reference</th>
                    <th scope="col" className="py-3 px-5">Amount</th>
                    <th scope="col" className="py-3 px-5">UPI transaction ID</th>
                    <th scope="col" className="py-3 px-5">Status</th>
                    <th scope="col" className="py-3 px-5">Remarks</th>
                    <th scope="col" className="py-3 px-5">Submitted</th>
                    <th scope="col" className="py-3 px-5">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                  {deposits.data.items.map((deposit: Deposit) => (
                    <tr key={deposit.id} className="hover:bg-zinc-50 dark:hover:bg-white/[0.02] transition align-top">
                      <td className="py-3.5 px-5 font-mono text-zinc-500 whitespace-nowrap">{deposit.reference}</td>
                      <td className="py-3.5 px-5 tabular-nums font-semibold text-zinc-900 dark:text-white whitespace-nowrap">
                        {formatINR(deposit.amount)}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-zinc-700 dark:text-zinc-300 break-all">{deposit.upiTransactionId}</td>
                      <td className="py-3.5 px-5">
                        <StatusBadge status={deposit.status} kind="deposit" />
                        {deposit.reviewedAt && (
                          <div className="text-[10px] text-zinc-500 mt-1 whitespace-nowrap">Reviewed {formatDateTime(deposit.reviewedAt)}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-600 dark:text-zinc-400 max-w-56">
                        {deposit.status === 'REJECTED' && deposit.rejectionReason ? (
                          <span className="text-rose-600 dark:text-rose-400">{deposit.rejectionReason}</span>
                        ) : (
                          deposit.adminRemarks || '—'
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-zinc-500 dark:text-zinc-400 whitespace-nowrap">
                        {formatDateTime(deposit.createdAt)}
                      </td>
                      <td className="py-3.5 px-5">
                        {deposit.hasReceipt ? (
                          <button
                            type="button"
                            disabled={viewer.busy}
                            onClick={() =>
                              viewer.open(`Receipt ${deposit.reference}`, () => api.getDepositReceipt(token, deposit.id))
                            }
                            className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium disabled:opacity-50 whitespace-nowrap"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>View receipt</span>
                          </button>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination meta={deposits.data.meta} onPageChange={setPage} disabled={deposits.loading} />
          </>
        )}
      </div>

      {isAddOpen && config && (
        <AddMoneyModal
          token={token}
          config={config}
          onClose={() => setIsAddOpen(false)}
          onCreated={handleDepositCreated}
        />
      )}

      {viewer.modal}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Add money flow
// ---------------------------------------------------------------------------
type Step = 1 | 2 | 3;

function StepIndicator({ step }: { step: Step }) {
  const steps = ['Amount', 'Pay by UPI', 'Upload receipt'];
  return (
    <ol className="grid grid-cols-3 gap-2 mb-5" aria-label="Add money steps">
      {steps.map((label, index) => {
        const number = index + 1;
        const state = number < step ? 'done' : number === step ? 'current' : 'upcoming';
        return (
          <li
            key={label}
            aria-current={state === 'current' ? 'step' : undefined}
            className={`rounded-xl border px-2.5 py-2 text-[11px] font-semibold flex items-center gap-1.5 ${
              state === 'current'
                ? 'border-blue-600/40 bg-blue-600/10 text-blue-700 dark:text-blue-300'
                : state === 'done'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                : 'border-zinc-200 dark:border-white/10 text-zinc-500'
            }`}
          >
            {state === 'done' ? <Check className="w-3 h-3 shrink-0" aria-label="Completed" /> : <span className="font-mono">{number}.</span>}
            <span className="truncate">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('failed');
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition shrink-0"
      aria-label={state === 'copied' ? `${label} copied` : `Copy ${label}`}
      aria-live="polite"
    >
      {state === 'copied' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
      <span>{state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy manually' : 'Copy'}</span>
    </button>
  );
}

function AddMoneyModal({
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
  const [step, setStep] = useState<Step>(1);
  const [amountInput, setAmountInput] = useState('');
  const [amount, setAmount] = useState<number | null>(null);
  const [utr, setUtr] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<Deposit | null>(null);

  const upiAvailable = Boolean(config.upiId);
  const upiLink =
    amount !== null
      ? `upi://pay?pa=${encodeURIComponent(config.upiId)}&pn=${encodeURIComponent(config.upiPayeeName || '')}&am=${amount.toFixed(2)}&cu=INR`
      : '';

  const handleAmountSubmit = (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseAmount(amountInput);
    if (parsed.value === null) {
      setError(parsed.error);
      return;
    }
    if (parsed.value < config.minTopup) {
      setError(`The minimum top-up is ${formatINR(config.minTopup)}.`);
      return;
    }
    if (parsed.value > config.maxTopup) {
      setError(`The maximum top-up is ${formatINR(config.maxTopup)}.`);
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
      setError('UPI transaction ID / UTR must be 8 to 35 letters or digits, without spaces.');
      return;
    }
    if (!receipt) {
      setError('Please upload your payment receipt.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      const deposit = await api.createDeposit(token, { amount, upiTransactionId: cleanUtr, receipt });
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
      <Modal title="Deposit submitted" onClose={onClose}>
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" aria-hidden="true" />
          <p className="text-sm font-semibold text-zinc-900 dark:text-white">
            We have received your payment details for {formatINR(created.amount)}.
          </p>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs text-left">
            <DetailRow label="Reference" value={<span className="font-mono">{created.reference}</span>} />
            <DetailRow label="UPI transaction ID" value={<span className="font-mono">{created.upiTransactionId}</span>} />
            <DetailRow label="Submitted" value={formatDateTime(created.createdAt)} />
            <DetailRow label="Status" value={<StatusBadge status={created.status} kind="deposit" />} />
          </div>
          <div className="p-3 rounded-xl bg-blue-500/[0.06] border border-blue-500/15 text-xs text-left">
            <div className="font-semibold text-zinc-900 dark:text-white mb-1.5">What happens next</div>
            <ol className="list-decimal pl-4 space-y-1 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              <li>An admin checks the UPI transaction ID and receipt against the payment received.</li>
              <li>Once approved, {formatINR(created.amount)} is added to your wallet balance.</li>
              <li>You get a notification with the outcome. If it is rejected, the reason is shown in your deposit history.</li>
            </ol>
          </div>
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
      description="Pay by UPI, then share the transaction ID and receipt for verification."
      onClose={onClose}
      closeDisabled={submitting}
    >
      <StepIndicator step={step} />

      {error && <Alert className="mb-4">{error}</Alert>}

      {step === 1 && (
        <form onSubmit={handleAmountSubmit} className="space-y-4" noValidate>
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="topup-amount" className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Amount (₹)<RequiredMark />
              </label>
              <span className="text-[11px] text-zinc-500 tabular-nums font-medium">
                {formatINRShort(config.minTopup)} – {formatINRShort(config.maxTopup)}
              </span>
            </div>
            <input
              id="topup-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              autoFocus
              placeholder={`e.g. ${config.minTopup}`}
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby="topup-amount-help"
              className={`${inputClass} tabular-nums text-sm font-semibold`}
            />
            <p id="topup-amount-help" className="text-[11px] text-zinc-500 mt-1.5">
              Enter the exact amount you will pay, between {formatINR(config.minTopup)} and {formatINR(config.maxTopup)}.
              Up to 2 decimal places.
            </p>
          </div>
          {!upiAvailable && (
            <Alert tone="warning">UPI payments are not available right now. Please try again later.</Alert>
          )}
          <button type="submit" disabled={!upiAvailable} className={`${primaryButtonClass} w-full`}>
            <span>Continue</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </form>
      )}

      {step === 2 && amount !== null && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[10px] uppercase text-zinc-500 font-medium">Pay to UPI ID</div>
                <div className="font-mono text-sm text-zinc-900 dark:text-white break-all select-all">{config.upiId}</div>
              </div>
              <CopyButton value={config.upiId} label="UPI ID" />
            </div>
            <div>
              <div className="text-[10px] uppercase text-zinc-500 font-medium">Payee name</div>
              <div className="text-zinc-900 dark:text-white font-medium">{config.upiPayeeName || '—'}</div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] uppercase text-zinc-500 font-medium">Amount to pay</div>
                <div className="text-sm font-bold text-zinc-900 dark:text-white tabular-nums">{formatINR(amount)}</div>
              </div>
              <CopyButton value={amount.toFixed(2)} label="amount" />
            </div>
          </div>

          {config.depositInstructions && (
            <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
              {config.depositInstructions}
            </div>
          )}

          <a href={upiLink} className={`${accentButtonClass} w-full`}>
            <Smartphone className="w-3.5 h-3.5" />
            <span>Pay with UPI app</span>
          </a>
          <p className="text-[11px] text-zinc-500 leading-relaxed">
            The button opens a UPI app on phones. On a computer, pay the UPI ID above from your phone. Check that the
            payee name matches before you pay, and keep the payment screenshot.
          </p>

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
              <span>I have paid</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {step === 3 && amount !== null && (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.06] text-xs">
            <DetailRow label="Amount paid" value={<span className="tabular-nums font-semibold">{formatINR(amount)}</span>} strong />
            <DetailRow label="Paid to" value={<span className="font-mono">{config.upiId}</span>} />
          </div>

          <div>
            <label htmlFor="topup-utr" className={labelClass}>
              UPI transaction ID / UTR<RequiredMark />
            </label>
            <input
              id="topup-utr"
              type="text"
              autoComplete="off"
              maxLength={35}
              placeholder="e.g. 412345678901"
              value={utr}
              onChange={(e) => setUtr(e.target.value.replace(/\s+/g, '').toUpperCase())}
              disabled={submitting}
              aria-invalid={utr.length > 0 && !UTR_PATTERN.test(utr)}
              aria-describedby="topup-utr-help"
              className={`${inputClass} font-mono tracking-wider`}
            />
            <p id="topup-utr-help" className={utr.length > 0 && !UTR_PATTERN.test(utr) ? fieldErrorClass : 'text-[11px] text-zinc-500 mt-1.5'}>
              8 to 35 letters or digits, no spaces. You can find it in your UPI app under the payment details.
            </p>
          </div>

          <div>
            <span className={labelClass}>
              Payment receipt<RequiredMark />
            </span>
            {receipt ? (
              <div className="p-2.5 rounded-xl bg-blue-600/5 dark:bg-blue-600/10 border border-blue-600/30 flex items-center justify-between gap-2">
                <div className="min-w-0">
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
              <label className="block text-center py-5 cursor-pointer rounded-xl border border-dashed border-zinc-300 dark:border-white/15 hover:border-blue-600 dark:hover:border-blue-500 transition focus-within:border-blue-600">
                <UploadCloud className="w-7 h-7 mx-auto mb-1.5 text-zinc-400" />
                <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Click to upload receipt</span>
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
            <button type="submit" disabled={submitting} className={`${primaryButtonClass} flex-1`}>
              {submitting && <Spinner />}
              <span>{submitting ? 'Submitting...' : 'Submit for verification'}</span>
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
