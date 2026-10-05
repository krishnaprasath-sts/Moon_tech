import React, { useState, useId } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Loader2, CheckCircle2, XCircle, BadgeCheck, Eye, AlertTriangle } from 'lucide-react';
import { useAdminWithdrawal, useApproveWithdrawal, useRejectWithdrawal } from '../hooks/useFinance';
import { financeApi } from '../api';
import { ModalShell, DetailField, DetailSection } from './ModalShell';
import { FinanceStatusBadge } from './FinanceStatusBadge';
import { ActionModal } from './ActionModal';
import { CompleteWithdrawalModal } from './CompleteWithdrawalModal';
import { FileViewerModal } from './FileViewerModal';
import { CopyButton } from './CopyButton';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field, ErrorState, ViewOnlyNote, inputClass, btnGhostClass, btnSuccessClass, btnDangerOutlineClass, btnRowClass } from './ui';
import { formatINR, formatDate, formatDateTime, getApiErrorMessage, hasMaxTwoDecimals } from '../utils/finance';

interface WithdrawalDetailModalProps {
  withdrawalId: number | null;
  onClose: () => void;
}

type ActiveAction = 'approve' | 'reject' | 'complete' | 'proof' | null;

export const WithdrawalDetailModal: React.FC<WithdrawalDetailModalProps> = ({ withdrawalId, onClose }) => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const profitId = useId();
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [profitAmount, setProfitAmount] = useState('');

  const { data: withdrawal, isLoading, isError, error, refetch } = useAdminWithdrawal(withdrawalId);
  const approveMutation = useApproveWithdrawal();
  const rejectMutation = useRejectWithdrawal();

  const status = withdrawal?.status;
  const isOpenRequest = status === 'PENDING' || status === 'APPROVED';
  const canApprove = isAdmin && status === 'PENDING';
  const canReject = isAdmin && isOpenRequest;
  const canComplete = isAdmin && status === 'APPROVED';

  const openAction = (action: ActiveAction) => {
    setProfitAmount('');
    setActiveAction(action);
  };

  const validateProfit = (): string | null => {
    if (!withdrawal?.isEarly || profitAmount.trim() === '') return null;
    const value = Number(profitAmount);
    if (!Number.isFinite(value) || value < 0) return 'Profit amount cannot be negative';
    if (!hasMaxTwoDecimals(profitAmount)) return 'Profit amount supports a maximum of 2 decimal places';
    return null;
  };

  const handleApprove = async (remarks: string) => {
    if (!withdrawal) return;
    try {
      await approveMutation.mutateAsync({
        id: withdrawal.id,
        remarks: remarks || undefined,
        profitAmount: withdrawal.isEarly && profitAmount.trim() !== '' ? Number(profitAmount) : undefined,
      });
      toast.success(`${withdrawal.reference} approved. Send the payout, then mark it as paid.`, 'Withdrawal approved');
      setActiveAction(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to approve the withdrawal'));
    }
  };

  const handleReject = async (reason: string) => {
    if (!withdrawal) return;
    try {
      await rejectMutation.mutateAsync({ id: withdrawal.id, reason });
      toast.success(`${withdrawal.reference} has been rejected. The customer will see the reason.`, 'Withdrawal rejected');
      setActiveAction(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to reject the withdrawal'));
    }
  };

  const customerLabel = withdrawal?.customerName || withdrawal?.customerEmail || 'the customer';
  const accountNumber = withdrawal?.payoutAccountNumber || withdrawal?.payoutAccountMasked;

  return (
    <>
      <ModalShell
        isOpen={!!withdrawalId}
        onClose={onClose}
        title="Withdrawal Request"
        subtitle={withdrawal ? <span className="font-mono">{withdrawal.reference}</span> : 'Loading...'}
        icon={Banknote}
        maxWidthClass="max-w-3xl"
        footer={
          <>
            {!isAdmin && isOpenRequest && <ViewOnlyNote className="mr-auto" />}
            {canReject && (
              <button type="button" onClick={() => openAction('reject')} className={btnDangerOutlineClass}>
                <XCircle className="w-4 h-4" />
                Reject
              </button>
            )}
            {canApprove && (
              <button type="button" onClick={() => openAction('approve')} className={`${btnSuccessClass} px-4`}>
                <CheckCircle2 className="w-4 h-4" />
                Approve
              </button>
            )}
            {canComplete && (
              <button type="button" onClick={() => openAction('complete')} className={`${btnSuccessClass} px-4`}>
                <BadgeCheck className="w-4 h-4" />
                Mark as Paid
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
            Loading withdrawal...
          </div>
        )}

        {isError && (
          <ErrorState message={getApiErrorMessage(error, 'Failed to load the withdrawal.')} onRetry={() => refetch()} />
        )}

        {!isLoading && !isError && withdrawal && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <FinanceStatusBadge status={withdrawal.status} />
              {withdrawal.isEarly && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="w-3 h-3" />
                  Early withdrawal
                </span>
              )}
              <span className="text-[11px] text-slate-500 dark:text-slate-400">Requested {formatDateTime(withdrawal.createdAt)}</span>
            </div>

            {/* Amount summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                <p className="text-[11px] uppercase font-semibold text-slate-500">Principal</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">{formatINR(withdrawal.principalAmount)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <p className="text-[11px] uppercase font-semibold text-slate-500">Profit</p>
                <p className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400">+{formatINR(withdrawal.profitAmount)}</p>
              </div>
              <div className="p-4 rounded-2xl bg-brand-500/5 border border-brand-500/20">
                <p className="text-[11px] uppercase font-semibold text-slate-500">Total Payable</p>
                <p className="text-lg font-bold font-mono tabular-nums text-brand-600 dark:text-brand-400">
                  {formatINR(withdrawal.totalAmount)}
                  <CopyButton value={String(withdrawal.totalAmount)} label="total payable" />
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <DetailSection title="Customer">
                <DetailField label="Name">{withdrawal.customerName || '—'}</DetailField>
                <DetailField label="Email">{withdrawal.customerEmail || '—'}</DetailField>
                <DetailField label="Phone" mono>
                  {withdrawal.customerPhone || '—'}
                </DetailField>
                <Link
                  to={`/customers/${withdrawal.userId}`}
                  onClick={onClose}
                  className="inline-block text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
                >
                  Open customer profile (#{withdrawal.userId})
                </Link>
              </DetailSection>

              <DetailSection title={`Payout Destination (${withdrawal.payoutMethod})`}>
                {withdrawal.payoutMethod === 'UPI' ? (
                  <DetailField label="UPI ID" mono>
                    {withdrawal.payoutUpiId || '—'}
                    <CopyButton value={withdrawal.payoutUpiId} label="UPI ID" />
                  </DetailField>
                ) : (
                  <>
                    <DetailField label="Account Holder">
                      {withdrawal.payoutAccountHolder || '—'}
                      <CopyButton value={withdrawal.payoutAccountHolder} label="account holder" />
                    </DetailField>
                    <DetailField label="Bank">{withdrawal.payoutBankName || '—'}</DetailField>
                    <DetailField label="Account Number" mono>
                      {accountNumber || '—'}
                      {/* Only the full number is worth copying - the masked one cannot be used for a transfer */}
                      <CopyButton value={withdrawal.payoutAccountNumber} label="account number" />
                    </DetailField>
                    {!withdrawal.payoutAccountNumber && (
                      <p className="text-[10px] text-slate-400">The full account number is visible to managers only.</p>
                    )}
                    <DetailField label="IFSC" mono>
                      {withdrawal.payoutIfsc || '—'}
                      <CopyButton value={withdrawal.payoutIfsc} label="IFSC" />
                    </DetailField>
                  </>
                )}
              </DetailSection>

              <DetailSection title="Investment">
                <DetailField label="Reference" mono>
                  {withdrawal.investment?.reference || withdrawal.investmentReference}
                </DetailField>
                <DetailField label="Plan">{withdrawal.investment?.planName || withdrawal.planName}</DetailField>
                {withdrawal.investment && (
                  <>
                    <DetailField label="Invested / Expected Profit">
                      {formatINR(withdrawal.investment.amount)} / +{formatINR(withdrawal.investment.expectedProfit)}
                    </DetailField>
                    <DetailField label="Maturity Amount">{formatINR(withdrawal.investment.maturityAmount)}</DetailField>
                    <DetailField label="Period">
                      {withdrawal.investment.durationDays} days ({formatDate(withdrawal.investment.startDate)} to{' '}
                      {formatDate(withdrawal.investment.maturityDate)})
                    </DetailField>
                    <DetailField label="Investment Status">
                      <FinanceStatusBadge status={withdrawal.investment.status} />
                    </DetailField>
                  </>
                )}
              </DetailSection>

              <DetailSection title="Processing">
                <DetailField label="Reviewed At">{formatDateTime(withdrawal.reviewedAt)}</DetailField>
                <DetailField label="Completed At">{formatDateTime(withdrawal.completedAt)}</DetailField>
                <DetailField label="Payment Reference" mono>
                  {withdrawal.paymentReference || '—'}
                  <CopyButton value={withdrawal.paymentReference} label="payment reference" />
                </DetailField>
                {withdrawal.adminRemarks && <DetailField label="Admin Remarks">{withdrawal.adminRemarks}</DetailField>}
                {withdrawal.hasPaymentProof && (
                  <button type="button" onClick={() => openAction('proof')} className={btnRowClass}>
                    <Eye className="w-3.5 h-3.5" />
                    View payment proof
                  </button>
                )}
              </DetailSection>
            </div>

            {withdrawal.rejectionReason && (
              <div className="p-3 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl">
                <span className="text-[10px] text-rose-800 dark:text-rose-300 font-bold uppercase block mb-1">Rejection Reason</span>
                <p className="text-rose-700 dark:text-rose-300 text-xs">{withdrawal.rejectionReason}</p>
              </div>
            )}
          </>
        )}
      </ModalShell>

      {/* Approve */}
      <ActionModal
        isOpen={activeAction === 'approve' && !!withdrawal}
        onClose={() => setActiveAction(null)}
        onSubmit={handleApprove}
        validate={validateProfit}
        title="Approve Withdrawal"
        description={
          withdrawal && (
            <>
              Approve the withdrawal of{' '}
              <strong className="text-slate-900 dark:text-white">{formatINR(withdrawal.totalAmount)}</strong> for{' '}
              <strong className="text-slate-900 dark:text-white">{customerLabel}</strong>. After approval, send the
              payout and mark the request as paid.
            </>
          )
        }
        inputLabel="Remarks"
        placeholder="e.g. Payout details verified."
        confirmText="Approve Withdrawal"
        isLoading={approveMutation.isPending}
      >
        {withdrawal?.isEarly && (
          <Field
            label="Profit amount (₹)"
            htmlFor={profitId}
            optional
            hint={`This is an early withdrawal. Leave blank to pay the principal of ${formatINR(
              withdrawal.principalAmount
            )} only, or enter the profit to add to the payout.`}
          >
            <input
              id={profitId}
              type="number"
              step="0.01"
              min="0"
              inputMode="decimal"
              value={profitAmount}
              onChange={(e) => setProfitAmount(e.target.value)}
              placeholder="0.00"
              disabled={approveMutation.isPending}
              className={`${inputClass} font-mono font-bold`}
            />
          </Field>
        )}
      </ActionModal>

      {/* Reject */}
      <ActionModal
        isOpen={activeAction === 'reject' && !!withdrawal}
        onClose={() => setActiveAction(null)}
        onSubmit={handleReject}
        tone="danger"
        title="Reject Withdrawal"
        subtitle="The rejection reason is shown to the customer"
        description={
          withdrawal && (
            <>
              Withdrawal <span className="font-mono font-semibold">{withdrawal.reference}</span> of{' '}
              <strong className="text-slate-900 dark:text-white">{formatINR(withdrawal.totalAmount)}</strong> will be
              rejected and no payout will be made.
            </>
          )
        }
        inputLabel="Rejection reason"
        placeholder="e.g. Bank account details could not be verified."
        minLength={5}
        presets={[
          'Bank account details could not be verified',
          'Account holder name does not match the KYC record',
          'UPI ID is invalid or inactive',
        ]}
        confirmText="Confirm Rejection"
        isLoading={rejectMutation.isPending}
      />

      {/* Complete */}
      <CompleteWithdrawalModal
        withdrawal={withdrawal || null}
        isOpen={activeAction === 'complete'}
        onClose={() => setActiveAction(null)}
      />

      {/* Payment proof */}
      <FileViewerModal
        isOpen={activeAction === 'proof' && !!withdrawal}
        onClose={() => setActiveAction(null)}
        url={withdrawal ? financeApi.getWithdrawalProofPath(withdrawal.id) : null}
        title={`Payment Proof - ${withdrawal?.reference || ''}`}
        subtitle={
          withdrawal
            ? `${customerLabel} • ${formatINR(withdrawal.totalAmount)} • Ref ${withdrawal.paymentReference || '—'}`
            : undefined
        }
        downloadName={`payment_proof_${withdrawal?.reference || 'withdrawal'}`}
      />
    </>
  );
};
