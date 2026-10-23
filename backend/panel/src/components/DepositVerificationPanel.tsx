import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck, History } from 'lucide-react';
import { financeApi } from '../api';
import { AdminDeposit } from '../types';
import { formatINR, formatDateTime } from '../utils/finance';
import { KycStatusBadge } from './KycStatusBadge';

/**
 * Everything a reviewer should glance at before crediting a wallet: whether the
 * UTR was already used, the customer's KYC state and their deposit track record.
 * Rendered inside the "Approve Payment" dialog.
 */
export const DepositVerificationPanel: React.FC<{ deposit: AdminDeposit }> = ({ deposit }) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-deposit', deposit.id],
    queryFn: () => financeApi.getDepositById(deposit.id),
    staleTime: 15_000,
  });
  const detail = data?.data;
  const v = detail?.verification;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-500" role="status">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Running verification checks…
      </div>
    );
  }
  if (isError || !v) {
    return (
      <p className="text-[11px] text-slate-500">
        Verification checks are unavailable right now. Confirm the UTR against your bank statement manually.
      </p>
    );
  }

  const utrDanger = v.utrAlreadyCredited;
  const utrWarn = !utrDanger && v.utrMatches.length > 0;
  const kycOk = v.customerKycStatus === 'VERIFIED';

  return (
    <div className="space-y-2" aria-label="Verification checks">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5" /> Verification checks
      </p>

      <Check
        tone={utrDanger ? 'danger' : utrWarn ? 'warn' : 'ok'}
        title={
          utrDanger
            ? 'This transaction reference was already credited'
            : utrWarn
            ? 'This transaction reference appears on another submission'
            : `${deposit.paymentMethod === 'BANK_TRANSFER' ? 'Bank transfer reference' : 'UPI transaction ID'} has not been used before`
        }
      >
        {v.utrMatches.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {v.utrMatches.map((m) => (
              <li key={m.id} className="font-mono text-[11px]">
                {m.reference} · {formatINR(m.amount)} · {m.status} · {m.sameCustomer ? 'same customer' : m.customerName} ·{' '}
                {formatDateTime(m.createdAt)}
              </li>
            ))}
          </ul>
        )}
        {utrDanger && <p className="mt-1">Approving again will be refused by the server. Reject this submission as a duplicate.</p>}
      </Check>

      <Check
        tone={kycOk ? 'ok' : 'warn'}
        title={
          <span className="inline-flex items-center gap-2">
            Customer KYC
            {v.customerKycStatus ? <KycStatusBadge status={v.customerKycStatus} /> : <span className="text-slate-500">not started</span>}
          </span>
        }
      >
        {v.kycAccountHolderName
          ? `Registered bank account holder: ${v.kycAccountHolderName}. The sender name on the transfer receipt should match.`
          : 'No bank details on file yet. Compare the payer name on the receipt with the customer name.'}
      </Check>

      <Check
        tone={v.isFirstDeposit ? 'info' : v.previousDeposits.rejected > v.previousDeposits.approved ? 'warn' : 'ok'}
        title={
          v.isFirstDeposit
            ? 'First payment from this customer'
            : `Track record: ${v.previousDeposits.approved} approved · ${v.previousDeposits.rejected} rejected · ${v.previousDeposits.pending} pending`
        }
      >
        {typeof detail?.walletBalance === 'number' && <>Current wallet balance {formatINR(detail.walletBalance)}.</>}
      </Check>
    </div>
  );
};

const TONE: Record<'ok' | 'warn' | 'danger' | 'info', { box: string; icon: React.ReactNode }> = {
  ok: {
    box: 'border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 text-emerald-900 dark:text-emerald-200',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />,
  },
  warn: {
    box: 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200',
    icon: <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />,
  },
  danger: {
    box: 'border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 text-rose-900 dark:text-rose-200',
    icon: <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />,
  },
  info: {
    box: 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 text-slate-800 dark:text-slate-200',
    icon: <History className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />,
  },
};

const Check: React.FC<{ tone: keyof typeof TONE; title: React.ReactNode; children?: React.ReactNode }> = ({ tone, title, children }) => (
  <div className={`flex gap-2.5 rounded-lg border p-2.5 text-[11px] ${TONE[tone].box}`}>
    {TONE[tone].icon}
    <div className="min-w-0">
      <div className="font-semibold text-xs">{title}</div>
      {children && <div className="mt-0.5 opacity-90 leading-relaxed">{children}</div>}
    </div>
  </div>
);
