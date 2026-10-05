import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Loader2, XCircle, Clock } from 'lucide-react';
import { useAdminInvestment, useCancelInvestment, useSetEarlyWithdrawal } from '../hooks/useFinance';
import { ModalShell, DetailField, DetailSection } from './ModalShell';
import { FinanceStatusBadge } from './FinanceStatusBadge';
import { ActionModal } from './ActionModal';
import { Switch } from './Switch';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ErrorState, ViewOnlyNote, btnGhostClass, btnDangerOutlineClass, numCellClass, theadClass, tbodyClass } from './ui';
import { formatINR, formatDate, formatDateTime, getApiErrorMessage } from '../utils/finance';

interface InvestmentDetailModalProps {
  investmentId: number | null;
  onClose: () => void;
}

export const InvestmentDetailModal: React.FC<InvestmentDetailModalProps> = ({ investmentId, onClose }) => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const { data: investment, isLoading, isError, error, refetch } = useAdminInvestment(investmentId);
  const cancelMutation = useCancelInvestment();
  const earlyMutation = useSetEarlyWithdrawal();

  const isActive = investment?.status === 'ACTIVE';
  const canManage = isAdmin && isActive;

  const handleCancel = async (reason: string) => {
    if (!investment) return;
    try {
      await cancelMutation.mutateAsync({ id: investment.id, reason });
      toast.success(
        `${investment.reference} cancelled. ${formatINR(investment.amount)} has been refunded to the customer's wallet.`,
        'Investment cancelled'
      );
      setIsCancelOpen(false);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to cancel the investment'));
    }
  };

  const handleToggleEarly = async (allowed: boolean) => {
    if (!investment || earlyMutation.isPending) return;
    try {
      await earlyMutation.mutateAsync({ id: investment.id, allowed });
      toast.success(
        allowed
          ? `The customer can now request an early withdrawal of ${investment.reference}`
          : `Early withdrawal is no longer allowed for ${investment.reference}`
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to update early withdrawal'));
    }
  };

  const withdrawals = investment?.withdrawals || [];

  return (
    <>
      <ModalShell
        isOpen={!!investmentId}
        onClose={onClose}
        title="Investment Details"
        subtitle={investment ? <span className="font-mono">{investment.reference}</span> : 'Loading...'}
        icon={TrendingUp}
        maxWidthClass="max-w-3xl"
        footer={
          <>
            {!isAdmin && isActive && <ViewOnlyNote className="mr-auto" />}
            {canManage && (
              <button type="button" onClick={() => setIsCancelOpen(true)} className={btnDangerOutlineClass}>
                <XCircle className="w-4 h-4" />
                Cancel Investment
              </button>
            )}
            <button type="button" onClick={onClose} className={btnGhostClass}>
              Close
            </button>
          </>
        }
      >
        {isLoading && (
          <div className="py-12 text-center text-xs text-slate-400" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
            Loading investment...
          </div>
        )}

        {isError && (
          <ErrorState message={getApiErrorMessage(error, 'Failed to load the investment.')} onRetry={() => refetch()} />
        )}

        {!isLoading && !isError && investment && (
          <>
            {/* Amount summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <p className="text-[11px] uppercase font-semibold text-slate-500">Principal</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
                  {formatINR(investment.amount)}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-[11px] uppercase font-semibold text-slate-500">Expected Profit</p>
                <p className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatINR(investment.expectedProfit)}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20">
                <p className="text-[11px] uppercase font-semibold text-slate-500">Maturity Amount</p>
                <p className="text-lg font-bold font-mono tabular-nums text-brand-600 dark:text-brand-400">
                  {formatINR(investment.maturityAmount)}
                </p>
              </div>
            </div>

            {/* Maturity progress */}
            <div>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-brand-500" />
                  {isActive
                    ? `${investment.daysRemaining} day${investment.daysRemaining === 1 ? '' : 's'} remaining`
                    : `${investment.durationDays} day period`}
                </span>
                <span className="font-bold text-slate-700 dark:text-slate-300 tabular-nums">
                  {Math.min(100, Math.max(0, Number(investment.progressPercent) || 0))}%
                </span>
              </div>
              <div
                className="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.min(100, Math.max(0, Number(investment.progressPercent) || 0))}
                aria-label="Maturity progress"
              >
                <div
                  className="bg-gradient-to-r from-brand-500 to-blue-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, Number(investment.progressPercent) || 0))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <DetailSection title="Customer">
                <DetailField label="Name">{investment.customerName || '—'}</DetailField>
                <DetailField label="Email">{investment.customerEmail || '—'}</DetailField>
                <DetailField label="Phone" mono>
                  {investment.customerPhone || '—'}
                </DetailField>
                <Link
                  to={`/customers/${investment.userId}`}
                  onClick={onClose}
                  className="inline-block text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Open customer profile (#{investment.userId})
                </Link>
              </DetailSection>

              <DetailSection title="Plan">
                <DetailField label="Plan Name">{investment.planName}</DetailField>
                <DetailField label="Profit">
                  {investment.profitType === 'PERCENTAGE'
                    ? `${investment.profitValue}% of principal`
                    : `${formatINR(investment.profitValue)} fixed`}
                </DetailField>
                <DetailField label="Period">{investment.durationDays} days</DetailField>
                <DetailField label="Status">
                  <FinanceStatusBadge status={investment.status} />
                </DetailField>
              </DetailSection>

              <DetailSection title="Timeline">
                <DetailField label="Created At">{formatDateTime(investment.createdAt)}</DetailField>
                <DetailField label="Start Date">{formatDateTime(investment.startDate)}</DetailField>
                <DetailField label="Maturity Date">{formatDateTime(investment.maturityDate)}</DetailField>
                <DetailField label="Matured At">{formatDateTime(investment.maturedAt)}</DetailField>
                <DetailField label="Completed At">{formatDateTime(investment.completedAt)}</DetailField>
                {investment.cancelledAt && (
                  <DetailField label="Cancelled At">{formatDateTime(investment.cancelledAt)}</DetailField>
                )}
              </DetailSection>

              <DetailSection title="Withdrawal Controls">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">Allow early withdrawal</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Lets the customer withdraw before maturity. Pays the principal only unless a profit is set on
                      approval.
                    </p>
                  </div>
                  <Switch
                    checked={investment.earlyWithdrawalAllowed}
                    onChange={handleToggleEarly}
                    label="Allow early withdrawal"
                    disabled={!canManage}
                    busy={earlyMutation.isPending}
                    title={canManage ? undefined : 'Only managers can change this on active investments'}
                  />
                </div>
                <DetailField label="Customer Can Request Withdrawal">
                  {investment.canRequestWithdrawal ? 'Yes' : 'No'}
                </DetailField>
              </DetailSection>
            </div>

            {investment.cancelReason && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl">
                <span className="text-[10px] text-rose-800 dark:text-rose-300 font-bold uppercase block mb-1">
                  Cancellation Reason
                </span>
                <p className="text-rose-700 dark:text-rose-300 text-xs">{investment.cancelReason}</p>
              </div>
            )}

            {/* Withdrawals */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                Withdrawal Requests ({withdrawals.length})
              </h4>
              {withdrawals.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800">
                  No withdrawal has been requested for this investment.
                </p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className={theadClass}>
                      <tr>
                        <th className="py-3 px-3.5">Reference</th>
                        <th className="py-3 px-3.5 text-right">Total</th>
                        <th className="py-3 px-3.5">Status</th>
                        <th className="py-3 px-3.5">Requested</th>
                        <th className="py-3 px-3.5">Completed</th>
                      </tr>
                    </thead>
                    <tbody className={tbodyClass}>
                      {withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td className="py-3 px-3.5 font-mono font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {w.reference}
                          </td>
                          <td className={`py-3 px-3.5 font-bold text-slate-900 dark:text-white ${numCellClass}`}>
                            {formatINR(w.totalAmount)}
                          </td>
                          <td className="py-3 px-3.5">
                            <FinanceStatusBadge status={w.status} />
                            {w.rejectionReason && (
                              <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-1">{w.rejectionReason}</div>
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(w.createdAt)}
                          </td>
                          <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formatDate(w.completedAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </ModalShell>

      {/* Cancel Investment */}
      <ActionModal
        isOpen={isCancelOpen && !!investment}
        onClose={() => setIsCancelOpen(false)}
        onSubmit={handleCancel}
        tone="danger"
        title="Cancel Investment"
        description={
          investment && (
            <>
              Cancelling <span className="font-mono font-semibold">{investment.reference}</span> stops the investment
              and refunds the principal of{' '}
              <strong className="text-slate-900 dark:text-white">{formatINR(investment.amount)}</strong> to the
              customer's wallet. No profit is paid. This cannot be undone.
            </>
          )
        }
        inputLabel="Cancellation reason"
        placeholder="e.g. Cancelled on customer request."
        minLength={5}
        confirmText="Cancel & Refund Principal"
        isLoading={cancelMutation.isPending}
      />
    </>
  );
};
