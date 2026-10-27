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
                <p className="text-[11px] uppercase font-semibold text-slate-500">
                  {investment.payoutMode === 'DAILY'
                    ? investment.isOpenEnded
                      ? 'Profit Per Month'
                      : 'Total Expected Profit'
                    : 'Expected Profit'}
                </p>
                <p className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatINR(investment.payoutMode === 'DAILY' && investment.isOpenEnded ? investment.monthlyProfit : investment.expectedProfit)}
                </p>
                {investment.payoutMode === 'DAILY' && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {formatINR(investment.dailyProfit)} / day · {formatINR(investment.weeklyProfit)} / week · {formatINR(investment.monthlyProfit)} / month
                    {!investment.isOpenEnded ? ` · ${investment.profitDays} paying days` : ''}
                  </p>
                )}
                {investment.payoutMode === 'MONTHLY' && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {formatINR(investment.monthlyProfit)} / month · credited on start date at 6:00 AM IST
                  </p>
                )}
              </div>
              <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20">
                <p className="text-[11px] uppercase font-semibold text-slate-500">
                  {investment.payoutMode === 'DAILY' || investment.payoutMode === 'MONTHLY' ? 'Profit Credited So Far' : 'Maturity Amount'}
                </p>
                <p className="text-lg font-bold font-mono tabular-nums text-brand-600 dark:text-brand-400">
                  {formatINR(investment.payoutMode === 'DAILY' || investment.payoutMode === 'MONTHLY' ? investment.profitCredited : investment.maturityAmount)}
                </p>
                {(investment.payoutMode === 'DAILY' || investment.payoutMode === 'MONTHLY') && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    {investment.isOpenEnded
                      ? `Capital returned when closed, less ${investment.feePercent}% fee (${formatINR(investment.netCapitalOnWithdrawal)} net)`
                      : `${formatINR(investment.profitRemaining)} remaining · capital returns to the capital wallet at maturity`}
                  </p>
                )}
              </div>
            </div>

            {/* Maturity progress */}
            {!investment.isOpenEnded && (
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
            )}

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
                  {investment.payoutMode === 'MONTHLY'
                    ? `${investment.profitValue}% of capital credited monthly on start date at 6:00 AM IST`
                    : investment.payoutMode === 'DAILY'
                    ? investment.rateBasis === 'PER_MONTH'
                      ? `${investment.profitValue}% of capital per month = ${investment.dailyRatePercent}% per working day, 20 credits a month (Mon–Fri, 6:00 AM IST)`
                      : investment.rateBasis === 'PER_YEAR'
                      ? `${investment.profitValue}% of capital per year = ${investment.dailyRatePercent}% per working day, 240 credits a year (Mon–Fri, 6:00 AM IST)`
                      : `${investment.profitValue}% of capital every working day (Mon–Fri, 6:00 AM IST) — legacy rate`
                    : investment.profitType === 'PERCENTAGE'
                    ? `${investment.profitValue}% of principal at maturity`
                    : `${formatINR(investment.profitValue)} fixed at maturity`}
                </DetailField>
                <DetailField label="Period">
                  {investment.isOpenEnded ? 'Open-ended (until the customer closes it)' : `${investment.durationDays} days`}
                </DetailField>
                <DetailField label="Early withdrawal fee">
                  {investment.earlyExitFeeApplies
                    ? `${investment.feePercent}% (${formatINR(investment.capitalWithdrawalFee)}) if closed now · customer receives ${formatINR(
                        investment.netCapitalOnWithdrawal
                      )}`
                    : `None (${investment.feePercent}% applied only before maturity) · customer receives ${formatINR(
                        investment.netCapitalOnWithdrawal
                      )}`}
                </DetailField>
                <DetailField label="Status">
                  <FinanceStatusBadge status={investment.status} />
                </DetailField>
              </DetailSection>

              <DetailSection title="Timeline">
                <DetailField label="Created At">{formatDateTime(investment.createdAt)}</DetailField>
                <DetailField label="Start Date">{formatDateTime(investment.startDate)}</DetailField>
                <DetailField label="Maturity Date">
                  {investment.maturityDate ? formatDateTime(investment.maturityDate) : 'None (open-ended)'}
                </DetailField>
                <DetailField label="Matured At">{formatDateTime(investment.maturedAt)}</DetailField>
                <DetailField label="Completed At">{formatDateTime(investment.completedAt)}</DetailField>
                {investment.cancelledAt && (
                  <DetailField label="Cancelled At">{formatDateTime(investment.cancelledAt)}</DetailField>
                )}
              </DetailSection>

              <DetailSection title="Withdrawal Controls">
                {Number(investment.lockInDays) > 0 && (
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Allow early exit</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Legacy investment with a lock-in until{' '}
                        {investment.lockInEndsAt ? formatDateTime(investment.lockInEndsAt) : 'the end of its term'}. Lets the
                        customer withdraw the capital earlier; the early withdrawal fee still applies.
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
                )}
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Customers can close an investment at any time. Closing it before maturity deducts the early withdrawal
                  fee; after maturity the capital is paid in full.
                </p>
                <DetailField label="Customer Can Request Withdrawal">
                  {investment.canRequestWithdrawal ? 'Yes' : 'No'}
                </DetailField>
              </DetailSection>
            </div>

            {(investment.payoutMode === 'DAILY' || investment.payoutMode === 'MONTHLY') && (
              <DetailSection title={investment.payoutMode === 'MONTHLY' ? 'Monthly profit credits' : 'Daily profit credits'}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                  <span>
                    {investment.creditsPerCycle ? (
                      <>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {investment.creditsThisCycle} of {investment.creditsPerCycle}
                        </span>{' '}
                        credits this month (cycle {investment.currentCycle + 1}) · {investment.creditedDays} in total
                      </>
                    ) : (
                      <>
                        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
                          {investment.creditedDays} of {investment.profitDays}
                        </span>{' '}
                        working days credited
                      </>
                    )}{' '}
                    · {formatINR(investment.dailyProfit)} per day
                  </span>
                  {investment.nextCreditAt && (
                    <span className={`inline-flex items-center gap-1 font-semibold ${investment.nextCreditDue ? 'text-brand-600 dark:text-brand-400' : 'text-slate-500'}`}>
                      <Clock className="w-3 h-3" />
                      {investment.nextCreditDue ? 'Next credit due now (job catching up)' : `Next credit ${formatDateTime(investment.nextCreditAt)}`}
                    </span>
                  )}
                </div>
                {(investment.profitCredits || []).length === 0 ? (
                  <p className="text-[11px] text-slate-500 mt-2">
                    Nothing credited yet. The first credit lands on the first working day after the start date at 6:00 AM IST.
                  </p>
                ) : (
                  <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800">
                    <table className="w-full text-xs">
                      <thead className={theadClass}>
                        <tr>
                          <th className="py-2 px-3 text-left">#</th>
                          <th className="py-2 px-3 text-left">Profit day</th>
                          <th className="py-2 px-3 text-left">Credited at</th>
                          <th className="py-2 px-3 text-right">Amount</th>
                          <th className="py-2 px-3 text-right">Ledger</th>
                        </tr>
                      </thead>
                      <tbody className={tbodyClass}>
                        {(investment.profitCredits || []).map((c, i, arr) => (
                          <tr key={c.id}>
                            <td className="py-2 px-3 text-slate-400 tabular-nums">{arr.length - i}</td>
                            <td className="py-2 px-3 text-slate-800 dark:text-slate-200">{formatDate(c.creditDay)}</td>
                            <td className="py-2 px-3 text-slate-500">{formatDateTime(c.creditedAt)}</td>
                            <td className={`py-2 px-3 ${numCellClass} text-emerald-600 dark:text-emerald-400 font-semibold`}>+{formatINR(c.amount)}</td>
                            <td className={`py-2 px-3 ${numCellClass} text-slate-400`}>{c.walletTransactionId ? `#${c.walletTransactionId}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DetailSection>
            )}

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
                        <th className="py-3 px-3.5 text-right">Gross</th>
                        <th className="py-3 px-3.5 text-right">Fee</th>
                        <th className="py-3 px-3.5 text-right">Net</th>
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
                          <td className={`py-3 px-3.5 text-slate-700 dark:text-slate-300 ${numCellClass}`}>
                            {formatINR(w.totalAmount)}
                          </td>
                          <td className={`py-3 px-3.5 text-rose-600 dark:text-rose-400 ${numCellClass}`}>
                            {Number(w.feeAmount) > 0 ? `-${formatINR(w.feeAmount)}` : '—'}
                          </td>
                          <td className={`py-3 px-3.5 font-bold text-slate-900 dark:text-white ${numCellClass}`}>
                            {formatINR(w.netAmount ?? w.totalAmount)}
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
