import React, { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Landmark,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { useBankChangeRequest, useApproveBankChange, useRejectBankChange } from '../hooks/useBankChanges';
import { bankChangeApi } from '../api/bankChanges';
import { ModalShell, DetailField } from './ModalShell';
import { ActionModal } from './ActionModal';
import { FileViewerModal } from './FileViewerModal';
import { CopyButton } from './CopyButton';
import { KycStatusBadge } from './KycStatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  ErrorState,
  FormError,
  ViewOnlyNote,
  labelClass,
  textareaClass,
  btnGhostClass,
  btnSuccessClass,
  btnDangerOutlineClass,
  btnRowClass,
} from './ui';
import { BankAccountSnapshot, BankChangeStatus } from '../types';
import { formatDateTime, getApiErrorMessage } from '../utils/finance';

const STATUS_CHIP: Record<BankChangeStatus, { label: string; className: string }> = {
  PENDING: { label: 'Pending', className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  REJECTED: { label: 'Rejected', className: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
  CANCELLED: { label: 'Cancelled', className: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20' },
};

export const BankChangeStatusChip: React.FC<{ status: BankChangeStatus }> = ({ status }) => {
  const chip = STATUS_CHIP[status] || STATUS_CHIP.PENDING;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${chip.className}`}>
      {chip.label}
    </span>
  );
};

const AccountCard: React.FC<{
  title: string;
  account: BankAccountSnapshot | null;
  tone: 'old' | 'new' | 'kyc';
  fullAccountNumber?: string | null;
  footer?: React.ReactNode;
}> = ({ title, account, tone, fullAccountNumber, footer }) => {
  const toneClass =
    tone === 'new'
      ? 'border-brand-500/40 bg-brand-500/5'
      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40';
  return (
    <div className={`p-4 rounded-2xl border space-y-3 text-xs ${toneClass}`}>
      <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{title}</h4>
      {account ? (
        <>
          <DetailField label="Account holder">
            {account.accountHolderName || '—'}
            {tone === 'new' && <CopyButton value={account.accountHolderName} label="account holder" />}
          </DetailField>
          <DetailField label="Account number" mono>
            {fullAccountNumber || account.accountNumberMasked || '—'}
            {fullAccountNumber && <CopyButton value={fullAccountNumber} label="account number" />}
          </DetailField>
          <DetailField label="IFSC" mono>
            {account.ifscCode || '—'}
            {tone === 'new' && <CopyButton value={account.ifscCode} label="IFSC" />}
          </DetailField>
          <DetailField label="Bank">{account.bankName || '—'}</DetailField>
          <DetailField label="Branch">{account.bankBranch || '—'}</DetailField>
        </>
      ) : (
        <p className="text-slate-500 dark:text-slate-400">No bank account on file.</p>
      )}
      {footer}
    </div>
  );
};

const MatchLine: React.FC<{ ok: boolean; okText: string; badText: string }> = ({ ok, okText, badText }) => (
  <p className={`flex items-center gap-1.5 font-semibold ${ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
    {ok ? <ShieldCheck className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
    {ok ? okText : badText}
  </p>
);

interface BankChangeReviewModalProps {
  requestId: number | null;
  onClose: () => void;
}

type ActiveAction = 'approve' | 'reject' | 'proof' | null;

export const BankChangeReviewModal: React.FC<BankChangeReviewModalProps> = ({ requestId, onClose }) => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const remarksId = useId();
  const [remarks, setRemarks] = useState('');
  const [remarksError, setRemarksError] = useState('');
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);

  const { data: request, isLoading, isError, error, refetch } = useBankChangeRequest(requestId);
  const approveMutation = useApproveBankChange();
  const rejectMutation = useRejectBankChange();

  useEffect(() => {
    setRemarks('');
    setRemarksError('');
    setActiveAction(null);
  }, [requestId]);

  const isPending = request?.status === 'PENDING';
  const canReview = isAdmin && isPending;
  const busy = approveMutation.isPending || rejectMutation.isPending;

  const startReject = () => {
    if (remarks.trim().length < 5) {
      setRemarksError('Enter a reason (at least 5 characters) before rejecting. The customer will see it.');
      return;
    }
    setRemarksError('');
    setActiveAction('reject');
  };

  const handleApprove = async () => {
    if (!request) return;
    try {
      await approveMutation.mutateAsync({ id: request.id, remarks: remarks.trim() || undefined });
      toast.success(`New payouts for ${request.customer.name} will go to the account ending ${request.requested.accountNumberMasked || ''}.`, 'Bank change approved');
      setActiveAction(null);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to approve the bank change'));
    }
  };

  const handleReject = async () => {
    if (!request) return;
    try {
      await rejectMutation.mutateAsync({ id: request.id, remarks: remarks.trim() });
      toast.success(`The current account stays in use. ${request.customer.name} will see your reason.`, 'Bank change rejected');
      setActiveAction(null);
      onClose();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to reject the bank change'));
    }
  };

  const kyc = request?.kyc;
  const kycSnapshot: BankAccountSnapshot | null = kyc
    ? {
        accountHolderName: kyc.accountHolderName,
        accountNumberMasked: kyc.accountNumberMasked,
        ifscCode: kyc.ifscCode,
        bankName: kyc.bankName,
        bankBranch: kyc.bankBranch,
      }
    : null;

  return (
    <>
      <ModalShell
        isOpen={!!requestId}
        onClose={onClose}
        disableClose={busy}
        title="Bank Account Change"
        subtitle={request ? `Request #${request.id} · ${request.customer.name}` : 'Loading...'}
        icon={Landmark}
        tone={request?.holderNameChanged ? 'danger' : 'brand'}
        maxWidthClass="max-w-4xl"
        footer={
          <>
            {!isAdmin && isPending && <ViewOnlyNote className="mr-auto" />}
            {canReview && (
              <>
                <button type="button" onClick={startReject} disabled={busy} className={btnDangerOutlineClass}>
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button type="button" onClick={() => setActiveAction('approve')} disabled={busy} className={`${btnSuccessClass} px-4`}>
                  <CheckCircle2 className="w-4 h-4" />
                  Approve change
                </button>
              </>
            )}
            <button type="button" onClick={onClose} disabled={busy} className={btnGhostClass}>
              Close
            </button>
          </>
        }
      >
        {isLoading && (
          <div className="py-12 text-center text-xs text-slate-400" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500 mx-auto mb-2" />
            Loading request...
          </div>
        )}

        {isError && <ErrorState message={getApiErrorMessage(error, 'Failed to load the bank change request.')} onRetry={() => refetch()} />}

        {!isLoading && !isError && request && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <BankChangeStatusChip status={request.status} />
              <span>Requested {formatDateTime(request.createdAt)}</span>
              {request.ipAddress && (
                <span>
                  · IP <span className="font-mono">{request.ipAddress}</span>
                </span>
              )}
              {request.previousRequests > 0 && (
                <span className="font-semibold text-amber-700 dark:text-amber-400">
                  · {request.previousRequests} earlier request{request.previousRequests === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {/* Fraud signal: new holder name */}
            {request.holderNameChanged && (
              <div role="alert" className="p-4 rounded-2xl border-2 border-rose-400 dark:border-rose-500/60 bg-rose-50 dark:bg-rose-500/10 text-rose-800 dark:text-rose-200 text-xs flex gap-2.5">
                <AlertTriangle className="w-5 h-5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-bold">Account holder name is changing</p>
                  <p className="mt-0.5">
                    The new account is in the name of <strong>{request.requested.accountHolderName || '—'}</strong>, not{' '}
                    <strong>{request.previous?.accountHolderName || '—'}</strong>. Payouts to a third party are a common fraud
                    pattern - confirm with the customer and check the proof carefully before approving.
                  </p>
                </div>
              </div>
            )}

            {request.openWithdrawals > 0 && (
              <div role="status" className="p-3 rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-900 dark:text-amber-200 text-xs flex gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>
                    {request.openWithdrawals} open withdrawal{request.openWithdrawals === 1 ? '' : 's'}
                  </strong>{' '}
                  will still be paid to the old account. Approving only affects new withdrawal requests.
                </p>
              </div>
            )}

            {/* Customer */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-4 gap-3">
              <DetailField label="Customer">{request.customer.name}</DetailField>
              <DetailField label="Customer ID" mono>
                {request.customer.customerId || '—'}
              </DetailField>
              <DetailField label="Email">{request.customer.email}</DetailField>
              <DetailField label="Phone" mono>
                {request.customer.phone || '—'}
              </DetailField>
              <Link
                to={`/customers/${request.customer.userId}`}
                onClick={onClose}
                className="sm:col-span-4 text-[11px] font-bold text-brand-600 dark:text-brand-400 hover:underline"
              >
                Open customer profile (#{request.customer.userId})
              </Link>
            </div>

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
              <AccountCard title="Current account" account={request.previous} tone="old" />
              <div className="hidden md:flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-slate-400" aria-hidden="true" />
              </div>
              <AccountCard
                title="Requested account"
                account={request.requested}
                tone="new"
                fullAccountNumber={request.requested.accountNumber}
                footer={
                  !request.requested.accountNumber ? (
                    <p className="text-[10px] text-slate-400">The full account number is visible to managers only.</p>
                  ) : undefined
                }
              />
            </div>

            {/* KYC reference */}
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">KYC bank account (reference)</h4>
                {kyc && <KycStatusBadge status={kyc.status} />}
              </div>
              {kyc && kycSnapshot ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <DetailField label="Holder">{kycSnapshot.accountHolderName || '—'}</DetailField>
                    <DetailField label="Account" mono>
                      {kycSnapshot.accountNumberMasked || '—'}
                    </DetailField>
                    <DetailField label="IFSC" mono>
                      {kycSnapshot.ifscCode || '—'}
                    </DetailField>
                    <DetailField label="Bank">{kycSnapshot.bankName || '—'}</DetailField>
                    <DetailField label="Branch">{kycSnapshot.bankBranch || '—'}</DetailField>
                  </div>
                  <div className="space-y-1">
                    <MatchLine
                      ok={kyc.holderMatchesKyc}
                      okText="Same holder name as KYC"
                      badText="Holder name differs from KYC"
                    />
                    <MatchLine
                      ok={kyc.requestedMatchesKyc}
                      okText="Requested account is the KYC-verified account"
                      badText="Requested account is not the KYC account"
                    />
                  </div>
                </>
              ) : (
                <p className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  The customer has no KYC record to compare against.
                </p>
              )}
            </div>

            {/* Reason + proof */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Customer&apos;s reason</h4>
                <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-words">{request.reason || '—'}</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-2">
                <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Proof of new account</h4>
                <p className="text-slate-500 dark:text-slate-400">
                  Check the holder name, account number and IFSC on the passbook / cancelled cheque / statement match the request.
                </p>
                <button type="button" onClick={() => setActiveAction('proof')} className={btnRowClass}>
                  <Eye className="w-3.5 h-3.5" />
                  View proof
                </button>
              </div>
            </div>

            {/* Review outcome */}
            {!isPending && (request.reviewedAt || request.adminRemarks) && (
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
                <DetailField label="Reviewed by">{request.reviewedBy || '—'}</DetailField>
                <DetailField label="Reviewed at">{formatDateTime(request.reviewedAt)}</DetailField>
                <DetailField label="Remarks">{request.adminRemarks || '—'}</DetailField>
              </div>
            )}

            {canReview && (
              <div>
                <label htmlFor={remarksId} className={labelClass}>
                  Remarks <span className="text-slate-400 font-medium">(required to reject - shown to the customer)</span>
                </label>
                <textarea
                  id={remarksId}
                  value={remarks}
                  onChange={(e) => {
                    setRemarks(e.target.value);
                    setRemarksError('');
                  }}
                  rows={3}
                  maxLength={500}
                  disabled={busy}
                  placeholder="e.g. Verified the cancelled cheque; holder name matches KYC."
                  className={textareaClass}
                />
                <FormError message={remarksError} />
              </div>
            )}
          </>
        )}
      </ModalShell>

      <ActionModal
        isOpen={activeAction === 'approve' && !!request}
        onClose={() => setActiveAction(null)}
        onSubmit={handleApprove}
        showInput={false}
        title="Approve Bank Change"
        description={
          request && (
            <>
              New withdrawals for <strong className="text-slate-900 dark:text-white">{request.customer.name}</strong> will be paid to{' '}
              <strong className="font-mono text-slate-900 dark:text-white">{request.requested.accountNumberMasked}</strong> (
              {request.requested.bankName || 'bank'}, {request.requested.ifscCode}).
              {request.holderNameChanged && (
                <span className="block mt-2 font-bold text-rose-600 dark:text-rose-400">
                  Warning: the account holder name is different from the current account.
                </span>
              )}
              {request.openWithdrawals > 0 && (
                <span className="block mt-2 text-amber-700 dark:text-amber-400">
                  {request.openWithdrawals} open withdrawal{request.openWithdrawals === 1 ? '' : 's'} will still go to the old account.
                </span>
              )}
            </>
          )
        }
        confirmText="Approve change"
        isLoading={approveMutation.isPending}
      />

      <ActionModal
        isOpen={activeAction === 'reject' && !!request}
        onClose={() => setActiveAction(null)}
        onSubmit={handleReject}
        showInput={false}
        tone="danger"
        title="Reject Bank Change"
        subtitle="The reason is shown to the customer"
        description={
          <>
            The customer&apos;s current payout account stays in use. Reason:
            <span className="block mt-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
              {remarks.trim()}
            </span>
          </>
        }
        confirmText="Confirm rejection"
        isLoading={rejectMutation.isPending}
      />

      <FileViewerModal
        isOpen={activeAction === 'proof' && !!request}
        onClose={() => setActiveAction(null)}
        url={request ? bankChangeApi.getProofPath(request.id) : null}
        title={`Bank change proof - request #${request?.id ?? ''}`}
        subtitle={request ? `${request.customer.name} · ${request.requested.accountNumberMasked || ''} · ${request.requested.bankName || ''}` : undefined}
        downloadName={`bank_change_proof_${request?.id ?? ''}`}
      />
    </>
  );
};
