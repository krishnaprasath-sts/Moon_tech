import React, { useState, useId } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  ShieldCheck,
  XCircle,
  RotateCcw,
  CheckCircle2,
  FileText,
  User,
  CreditCard,
  ShieldAlert,
  Clock,
  Eye,
} from 'lucide-react';
import { useKyc, useVerifyKyc, useRejectKyc, useResubmitKyc } from '../hooks';
import { kycApi, KycDocumentType } from '../api';
import { KycStatusBadge } from '../components/KycStatusBadge';
import { AccountStatusBadge } from '../components/AccountStatusBadge';
import { RoleBadge } from '../components/RoleBadge';
import { ActionModal } from '../components/ActionModal';
import { FileViewerModal } from '../components/FileViewerModal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { KycStatus } from '../types';
import {
  Field,
  ViewOnlyNote,
  btnGhostClass,
  btnSecondaryClass,
  btnSuccessClass,
  btnDangerClass,
  btnRowClass,
  cardClass,
  inputClass,
} from '../components/ui';
import { formatDate, formatDateTime, getApiErrorMessage, getErrorStatus } from '../utils/finance';

type ActiveAction = 'verify' | 'reject' | 'resubmit' | null;

const DOCUMENTS: Array<{ key: KycDocumentType; label: string }> = [
  { key: 'passbook', label: 'Bank passbook / statement' },
  { key: 'pan', label: 'PAN card' },
  { key: 'aadhaar', label: 'Aadhaar card' },
];

const REJECT_PRESETS = [
  'Document image is blurry or unreadable',
  'PAN card name does not match the bank account holder name',
  'Aadhaar address does not match the provided address',
  'Bank passbook does not clearly show the IFSC code and account number',
  'Document appears modified, expired or invalid',
];

const RESUBMIT_PRESETS = [
  'Please re-upload a clear, high-resolution photo of your PAN card with all corners visible.',
  'Please re-upload your bank passbook showing your name, account number and IFSC code clearly.',
  'Your Aadhaar document was partially cropped. Please upload the complete document.',
];

const ACTION_COLORS: Record<string, string> = {
  APPROVE: 'text-emerald-600 dark:text-emerald-400',
  VERIFY: 'text-emerald-600 dark:text-emerald-400',
  REJECT: 'text-rose-600 dark:text-rose-400',
};

const DetailRow: React.FC<{ label: string; children: React.ReactNode; mono?: boolean }> = ({ label, children, mono }) => (
  <div>
    <span className="text-slate-500 block text-[11px] uppercase">{label}</span>
    <span className={`text-slate-800 dark:text-slate-200 font-medium break-words ${mono ? 'font-mono' : ''}`}>{children}</span>
  </div>
);

export const KycReviewPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { canApproveKyc } = useAuth();
  const remarksId = useId();

  const { data: kyc, isLoading, isError, error, refetch } = useKyc(id || '');
  const verifyMutation = useVerifyKyc();
  const rejectMutation = useRejectKyc();
  const resubmitMutation = useResubmitKyc();

  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [activeDocument, setActiveDocument] = useState<KycDocumentType | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse" role="status" aria-label="Loading KYC">
        <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-xl" />
        <div className="h-44 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
          <div className="h-80 bg-slate-200 dark:bg-slate-800 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !kyc) {
    const notFound = getErrorStatus(error) === 404;
    return (
      <div role="alert" className="p-8 text-center bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 rounded-2xl">
        <ShieldAlert className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto mb-3" />
        <h1 className="text-lg font-bold text-slate-900 dark:text-white">
          {notFound ? 'KYC application not found' : 'Could not load this KYC application'}
        </h1>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 mb-4">
          {notFound
            ? `There is no KYC record with ID ${id}. It may have been removed.`
            : getApiErrorMessage(error, 'Something went wrong while loading the application.')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <Link to="/kyc" className={btnGhostClass}>
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to KYC queue
          </Link>
          {!notFound && (
            <button type="button" onClick={() => refetch()} className={btnSecondaryClass}>
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  const openAction = (action: ActiveAction) => {
    setRejectRemarks('');
    setActiveAction(action);
  };

  const handleVerify = async (remarks: string) => {
    try {
      await verifyMutation.mutateAsync({ id: kyc.id, remarks: remarks || undefined });
      toast.success(`${kyc.customer.name}'s KYC is now verified`, 'KYC verified');
      setActiveAction(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to verify the KYC application'));
    }
  };

  const handleReject = async (rejectionReason: string) => {
    try {
      await rejectMutation.mutateAsync({ id: kyc.id, rejectionReason, remarks: rejectRemarks.trim() || undefined });
      toast.success(`${kyc.customer.name}'s KYC has been rejected. The customer will see the reason.`, 'KYC rejected');
      setActiveAction(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to reject the KYC application'));
    }
  };

  const handleResubmit = async (remarks: string) => {
    try {
      await resubmitMutation.mutateAsync({ id: kyc.id, remarks });
      toast.success(`${kyc.customer.name} has been asked to upload corrected documents`, 'Resubmission requested');
      setActiveAction(null);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to request resubmission'));
    }
  };

  const isVerified = kyc.status === KycStatus.VERIFIED;
  const isRejected = kyc.status === KycStatus.REJECTED;
  const isResubmission = kyc.status === KycStatus.RESUBMISSION_REQUIRED;
  const activeDocumentLabel = DOCUMENTS.find((d) => d.key === activeDocument)?.label || 'Document';

  return (
    <div className="space-y-6">
      <Link
        to="/kyc"
        className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to KYC queue
      </Link>

      {/* Header card */}
      <div className="bg-white dark:bg-[#000000] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 shadow-sm dark:shadow-xl transition-colors duration-200">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-center gap-4 min-w-0">
            <div
              aria-hidden="true"
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-tr from-brand-600 to-blue-600 flex items-center justify-center text-white shadow-xl shadow-brand-500/20 flex-shrink-0"
            >
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900 dark:text-white">KYC Review #{kyc.id}</h1>
                <KycStatusBadge status={kyc.status} />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>
                  <strong className="text-slate-700 dark:text-slate-200">{kyc.customer.name}</strong>
                </span>
                <span aria-hidden="true">•</span>
                <span className="break-all">{kyc.customer.email}</span>
                <span aria-hidden="true">•</span>
                <Link to={`/customers/${kyc.customer.id}`} className="text-brand-600 dark:text-brand-400 font-semibold hover:underline">
                  Open customer profile
                </Link>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {canApproveKyc ? (
              <>
                <button
                  type="button"
                  onClick={() => openAction('verify')}
                  disabled={isVerified}
                  title={isVerified ? 'Already verified' : undefined}
                  className={`${btnSuccessClass} px-4 py-2.5`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Verify KYC
                </button>
                <button
                  type="button"
                  onClick={() => openAction('reject')}
                  disabled={isRejected}
                  title={isRejected ? 'Already rejected' : undefined}
                  className={`${btnDangerClass} px-4 py-2.5`}
                >
                  <XCircle className="w-4 h-4" />
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => openAction('resubmit')}
                  disabled={isResubmission}
                  title={isResubmission ? 'Resubmission already requested' : undefined}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-amber-600/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-4 h-4" />
                  Request Resubmission
                </button>
              </>
            ) : (
              <ViewOnlyNote text="View only - KYC decisions require a manager" />
            )}
          </div>
        </div>

        {isVerified && (
          <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-xl text-xs flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
            <div>
              <span className="text-emerald-900 dark:text-emerald-200 font-bold uppercase block">Verified</span>
              <p className="text-emerald-700 dark:text-emerald-400 text-[11px] mt-0.5">
                Approved{kyc.reviewInfo?.reviewedBy?.email ? ` by ${kyc.reviewInfo.reviewedBy.email}` : ''}
                {kyc.reviewInfo?.reviewedAt ? ` on ${formatDateTime(kyc.reviewInfo.reviewedAt)}` : ''}.
              </p>
            </div>
          </div>
        )}

        {kyc.reviewInfo?.rejectionReason && !isVerified && (
          <div className="mt-4 p-4 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-xl text-xs">
            <span className="text-rose-900 dark:text-rose-200 font-bold uppercase block mb-1">
              {isResubmission ? 'Resubmission instructions sent to the customer' : 'Rejection reason sent to the customer'}
            </span>
            <p className="text-rose-700 dark:text-rose-300 leading-relaxed">{kyc.reviewInfo.rejectionReason}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer */}
        <div className={`${cardClass} space-y-4`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            Customer
          </h2>
          <div className="space-y-3 text-xs pt-2">
            <DetailRow label="Full Name">{kyc.customer.name}</DetailRow>
            <DetailRow label="Email">{kyc.customer.email}</DetailRow>
            <DetailRow label="Phone" mono>
              {kyc.customer.phone || '—'}
            </DetailRow>
            <div>
              <span className="text-slate-500 block text-[11px] uppercase">Referral Code</span>
              <span className="font-mono bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-800 text-brand-600 dark:text-brand-300 font-bold inline-block">
                {kyc.customer.referralCode || '—'}
              </span>
            </div>
            {kyc.customer.referredBy && (
              <DetailRow label="Referred By" mono>
                {kyc.customer.referredBy}
              </DetailRow>
            )}
            <div>
              <span className="text-slate-500 block text-[11px] uppercase mb-0.5">Account Status</span>
              <AccountStatusBadge status={kyc.customer.accountStatus} />
            </div>
            <DetailRow label="Member Since">{formatDate(kyc.customer.memberSince)}</DetailRow>
          </div>
        </div>

        {/* Identity & bank */}
        <div className={`${cardClass} space-y-4`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            Identity & Bank
          </h2>
          <div className="space-y-3 text-xs pt-2">
            <DetailRow label="PAN" mono>
              <span className="text-brand-600 dark:text-brand-300 font-bold tracking-wider">{kyc.identityDetails.maskedPan || '—'}</span>
            </DetailRow>
            <DetailRow label="Aadhaar" mono>
              <span className="font-bold tracking-wider">{kyc.identityDetails.maskedAadhaar || '—'}</span>
            </DetailRow>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <DetailRow label="Bank Account" mono>
                <span className="font-bold tracking-wider">{kyc.bankDetails.maskedAccountNumber || '—'}</span>
              </DetailRow>
            </div>
            <DetailRow label="Account Holder">{kyc.bankDetails.accountHolderName || '—'}</DetailRow>
            <DetailRow label="IFSC" mono>
              {kyc.bankDetails.ifscCode || '—'}
            </DetailRow>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <DetailRow label="Submitted">{formatDateTime(kyc.reviewInfo?.submittedAt)}</DetailRow>
            </div>
          </div>
        </div>

        {/* Documents */}
        <div className={`${cardClass} space-y-4`}>
          <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand-600 dark:text-brand-400" />
            Documents
          </h2>
          <div className="space-y-3 pt-2">
            {DOCUMENTS.map((doc) => {
              const available = kyc.documents?.[doc.key]?.available;
              return (
                <div
                  key={doc.key}
                  className="p-3.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-brand-500/10 text-brand-600 dark:text-brand-400 rounded-lg flex-shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{doc.label}</p>
                      <p className={`text-[10px] ${available ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                        {available ? 'Uploaded' : 'Not uploaded'}
                      </p>
                    </div>
                  </div>

                  {available && (
                    <button type="button" onClick={() => setActiveDocument(doc.key)} className={btnRowClass}>
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Documents are streamed securely to this screen and are never linked publicly.
          </p>
        </div>
      </div>

      {/* Review history */}
      <div className={cardClass}>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-brand-600 dark:text-brand-400" />
          Review History
        </h2>

        {!kyc.reviews || kyc.reviews.length === 0 ? (
          <p className="text-xs text-slate-500 py-4">No review actions have been recorded for this application yet.</p>
        ) : (
          <ol className="space-y-3">
            {kyc.reviews.map((rev) => (
              <li
                key={rev.id}
                className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className={`font-bold uppercase text-[11px] ${ACTION_COLORS[rev.action] || 'text-amber-600 dark:text-amber-400'}`}>
                      {rev.action}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500" aria-hidden="true">
                      •
                    </span>
                    <span className="text-slate-700 dark:text-slate-300 break-all">{rev.admin?.email || 'Staff'}</span>
                    {rev.admin?.role && <RoleBadge role={rev.admin.role} />}
                  </div>
                  {rev.remarks && <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{rev.remarks}</p>}
                </div>
                <div className="text-[11px] text-slate-500 whitespace-nowrap flex-shrink-0">{formatDateTime(rev.createdAt)}</div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Verify */}
      <ActionModal
        isOpen={activeAction === 'verify'}
        onClose={() => setActiveAction(null)}
        onSubmit={handleVerify}
        title="Verify KYC"
        description={
          <>
            Mark <strong className="text-slate-900 dark:text-white">{kyc.customer.name}</strong>'s identity and bank
            details as verified. Confirm the documents match the details on this page before approving.
          </>
        }
        inputLabel="Verification remarks"
        placeholder="e.g. All documents verified and match the submitted details."
        confirmText="Verify KYC"
        isLoading={verifyMutation.isPending}
      />

      {/* Reject */}
      <ActionModal
        isOpen={activeAction === 'reject'}
        onClose={() => setActiveAction(null)}
        onSubmit={handleReject}
        tone="danger"
        title="Reject KYC"
        subtitle="The rejection reason is shown to the customer"
        description={
          <>
            Reject <strong className="text-slate-900 dark:text-white">{kyc.customer.name}</strong>'s KYC application.
            They will need to submit a new application.
          </>
        }
        inputLabel="Rejection reason"
        placeholder="Explain why this application is being rejected"
        minLength={5}
        presets={REJECT_PRESETS}
        confirmText="Confirm Rejection"
        isLoading={rejectMutation.isPending}
      >
        <Field label="Internal remarks" htmlFor={remarksId} optional hint="Visible to staff only, in the review history">
          <input
            id={remarksId}
            type="text"
            value={rejectRemarks}
            onChange={(e) => setRejectRemarks(e.target.value)}
            maxLength={500}
            placeholder="Notes for the audit log"
            disabled={rejectMutation.isPending}
            className={inputClass}
          />
        </Field>
      </ActionModal>

      {/* Resubmission */}
      <ActionModal
        isOpen={activeAction === 'resubmit'}
        onClose={() => setActiveAction(null)}
        onSubmit={handleResubmit}
        tone="danger"
        title="Request Resubmission"
        subtitle="The instructions are shown to the customer"
        description={
          <>
            Ask <strong className="text-slate-900 dark:text-white">{kyc.customer.name}</strong> to upload corrected
            documents. Be specific about which document needs to be fixed and how.
          </>
        }
        inputLabel="Instructions for the customer"
        placeholder="Specify which document needs to be corrected and how"
        minLength={5}
        presets={RESUBMIT_PRESETS}
        confirmText="Send Resubmission Request"
        isLoading={resubmitMutation.isPending}
      />

      {/* Document viewer */}
      <FileViewerModal
        isOpen={!!activeDocument}
        onClose={() => setActiveDocument(null)}
        url={activeDocument ? kycApi.getDocumentPath(kyc.id, activeDocument) : null}
        title={activeDocumentLabel}
        subtitle={`${kyc.customer.name} • KYC #${kyc.id}`}
        downloadName={`${kyc.customer.name}_${activeDocument || 'document'}`}
      />
    </div>
  );
};
