import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, ArrowLeftRight, AlertTriangle, ExternalLink } from 'lucide-react';
import { WithdrawalBankCheck, WithdrawalBankFlag } from '../types';
import { formatDateTime } from '../utils/finance';

const FLAG_META: Record<WithdrawalBankFlag, { label: string; className: string; icon: typeof ShieldCheck }> = {
  OK: {
    label: 'KYC account',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
    icon: ShieldCheck,
  },
  CHANGED: {
    label: 'Changed account',
    className: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20',
    icon: ArrowLeftRight,
  },
  WARNING: {
    label: 'Check bank account',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    icon: AlertTriangle,
  },
};

/** Small icon badge for list rows */
export const BankFlagBadge: React.FC<{ flag?: WithdrawalBankFlag | null }> = ({ flag }) => {
  if (!flag) return null;
  const meta = FLAG_META[flag];
  const Icon = meta.icon;
  return (
    <span
      title={meta.label}
      aria-label={meta.label}
      role="img"
      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border ${meta.className}`}
    >
      <Icon className="w-3 h-3" />
    </span>
  );
};

const lastDigits = (masked?: string | null) => {
  if (!masked) return null;
  const digits = masked.replace(/\D/g, '');
  return digits.slice(-4) || masked;
};

const BOX_CLASS: Record<WithdrawalBankFlag, string> = {
  OK: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200',
  CHANGED: 'bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/30 text-indigo-800 dark:text-indigo-200',
  WARNING: 'bg-amber-50 dark:bg-amber-500/10 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200',
};

const linkClass = 'inline-flex items-center gap-1 font-bold underline-offset-2 hover:underline';

/** Prominent payout-account verification box shown next to the payout destination */
export const BankCheckBox: React.FC<{ check: WithdrawalBankCheck; onNavigate?: () => void }> = ({ check, onNavigate }) => {
  const meta = FLAG_META[check.level];
  const Icon = meta.icon;
  const change = check.approvedChange;

  return (
    <div role={check.level === 'WARNING' ? 'alert' : 'status'} className={`p-4 rounded-2xl border-2 text-xs space-y-2 ${BOX_CLASS[check.level]}`}>
      <div className="flex items-start gap-2.5">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Bank account check</p>
          <p className="text-sm font-bold">{check.title}</p>

          {check.kycAccountMasked && (
            <p>
              KYC account: <span className="font-mono font-semibold">{check.kycAccountMasked}</span>
              {check.kycIfsc && <span className="font-mono"> · {check.kycIfsc}</span>}
              {check.kycBankName && <> · {check.kycBankName}</>}
              {check.matchesKyc === true && <span className="font-bold"> · ✓ payout matches KYC</span>}
              {check.matchesKyc === false && <span className="font-bold"> · ⚠ payout differs from KYC</span>}
            </p>
          )}

          {change && (
            <p>
              Changed from ending{' '}
              <span className="font-mono font-semibold">{lastDigits(change.previousAccountMasked) || '—'}</span>
              {change.previousBankName && <> ({change.previousBankName})</>}
              {change.approvedAt && <> on {formatDateTime(change.approvedAt)}</>}
              {change.approvedBy && <> by {change.approvedBy}</>}, request{' '}
              <Link to={`/bank-changes?request=${change.id}`} onClick={onNavigate} className={linkClass}>
                #{change.id}
                <ExternalLink className="w-3 h-3" />
              </Link>
            </p>
          )}

          {check.notes.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5">
              {check.notes.map((note, i) => (
                <li key={i}>{note}</li>
              ))}
            </ul>
          )}

          {check.pendingChangeRequestId && (
            <p className="font-semibold">
              The customer has a pending bank change request{' '}
              <Link to={`/bank-changes?request=${check.pendingChangeRequestId}`} onClick={onNavigate} className={linkClass}>
                #{check.pendingChangeRequestId}
                <ExternalLink className="w-3 h-3" />
              </Link>
              . This withdrawal still goes to the account shown above.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
