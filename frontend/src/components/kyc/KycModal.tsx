"use client";

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Lock,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  FileText,
  UploadCloud,
  Check,
  Building2,
  CreditCard,
  Trash2,
} from 'lucide-react';
import { api, getErrorMessage } from '@/lib/api';
import { formatFileSize, validateReceiptFile } from '@/lib/format';
import { Spinner } from '@/components/ui/primitives';
import { useBackToClose } from '@/lib/useBackToClose';

type DocumentKey = 'pan' | 'aadhaar' | 'aadhaarBack' | 'passbook';

interface KycModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string | null;
  kycStatus: string;
  rejectionReason: string;
  /** Pre-fills the account holder name until the customer edits it. */
  defaultHolderName: string;
  /** Called after a successful submission so the page can refresh the KYC status. */
  onSubmitted: () => void | Promise<void>;
}

const PAN_PATTERN = /^[A-Za-z]{5}[0-9]{4}[A-Za-z]{1}$/;
const IFSC_PATTERN = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
const ACCOUNT_PATTERN = /^[0-9]{8,25}$/;
const AADHAAR_PATTERN = /^\d{4,20}$/;

const kycInputClass =
  'w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 transition shadow-2xs disabled:opacity-60';

function DocumentCard({
  title,
  file,
  uploadLabel,
  hint,
  disabled,
  onSelect,
  onRemove,
}: {
  title: string;
  file: File | null;
  uploadLabel: string;
  hint: string;
  disabled: boolean;
  onSelect: (file: File | null) => void;
  onRemove: () => void;
}) {
  const fileInput = (
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp,application/pdf"
      disabled={disabled}
      aria-label={`${title} document`}
      onChange={(e) => {
        onSelect(e.target.files?.[0] || null);
        // Allow re-selecting the same file after a validation error or removal
        e.target.value = '';
      }}
      className="sr-only"
    />
  );

  return (
    <div
      className={`p-4 rounded-2xl border transition-all min-w-0 ${
        file
          ? 'bg-blue-600/5 dark:bg-blue-600/10 border-blue-600/30'
          : 'bg-white dark:bg-zinc-900 border-dashed border-zinc-300 dark:border-white/15 hover:border-blue-600 dark:hover:border-blue-500'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-bold text-zinc-900 dark:text-white truncate">{title}</span>
        {file ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-600/10 px-2 py-0.5 rounded-md">
            <Check className="w-3 h-3" /> Ready
          </span>
        ) : (
          <span className="text-[10px] text-blue-600 font-bold shrink-0">* Required</span>
        )}
      </div>

      {file ? (
        <div className="space-y-3">
          <div className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-900 dark:text-white" title={file.name}>
              {file.name}
            </div>
            <span className="text-[10px] text-zinc-500 shrink-0 font-mono">{formatFileSize(file.size)}</span>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex-1 py-1.5 px-3 rounded-lg bg-zinc-200 dark:bg-zinc-800 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-[11px] font-semibold text-center cursor-pointer transition focus-within:outline-2 focus-within:outline-blue-600">
              Replace file
              {fileInput}
            </label>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition disabled:opacity-50"
              aria-label={`Remove ${title} file`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <label className="block text-center py-4 px-2 cursor-pointer rounded-xl focus-within:outline-2 focus-within:outline-blue-600">
          <UploadCloud className="w-8 h-8 mx-auto mb-2 text-zinc-400 transition" />
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">{uploadLabel}</span>
          <span className="text-[10px] text-zinc-400 block mt-0.5 break-words">{hint}</span>
          {fileInput}
        </label>
      )}
    </div>
  );
}

function ValidTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 font-medium">
      <Check className="w-3.5 h-3.5" /> {children}
    </span>
  );
}

export function KycModal({
  isOpen,
  onClose,
  token,
  kycStatus,
  rejectionReason,
  defaultHolderName,
  onSubmitted,
}: KycModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [pan, setPan] = useState('');
  const [aadhaarReference, setAadhaarReference] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [editedHolderName, setEditedHolderName] = useState<string | null>(null);
  const [ifsc, setIfsc] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [files, setFiles] = useState<Record<DocumentKey, File | null>>({ pan: null, aadhaar: null, aadhaarBack: null, passbook: null });

  const panelRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Phone back button closes the dialog instead of leaving the dashboard
  const { requestClose } = useBackToClose(isOpen, onClose);
  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const handleClose = useCallback(() => {
    // Never close while the upload is in flight: the user would lose the outcome
    if (submitting) return;
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setError('');
    setSuccess('');
    requestClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requestClose is stable per open
  }, [submitting, onClose]);

  // Escape closes, body scroll is locked and focus moves into the dialog while open
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleClose();
    };
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleEsc);
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEsc);
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [isOpen, handleClose]);

  if (!isOpen) return null;

  const accountHolderName = editedHolderName ?? defaultHolderName;
  const isUnderReview = kycStatus === 'PENDING' || kycStatus === 'UNDER_REVIEW';
  const isRejected = kycStatus === 'REJECTED' || kycStatus === 'RESUBMISSION_REQUIRED';
  const showForm = !isUnderReview && kycStatus !== 'VERIFIED';

  const handleFileSelect = (type: DocumentKey, file: File | null) => {
    if (!file) return;
    const problem = validateReceiptFile(file);
    if (problem) {
      setError(`${file.name}: ${problem}`);
      return;
    }
    setError('');
    setFiles((current) => ({ ...current, [type]: file }));
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSuccess('');

    if (!token) {
      setError('Your session has expired. Please sign in again to submit your verification.');
      return;
    }

    const cleanPan = pan.trim().toUpperCase();
    if (!PAN_PATTERN.test(cleanPan)) {
      setError('Enter a valid 10-character PAN (e.g. ABCDE1234F).');
      return;
    }

    const cleanAadhaar = aadhaarReference.trim().replace(/\s+/g, '');
    if (!AADHAAR_PATTERN.test(cleanAadhaar)) {
      setError('Aadhaar number or reference must be 4 to 20 digits.');
      return;
    }

    const cleanHolder = accountHolderName.trim() || defaultHolderName.trim();
    if (cleanHolder.length < 2) {
      setError('Account holder name must be at least 2 characters.');
      return;
    }

    const cleanAcc = accountNumber.trim();
    if (!ACCOUNT_PATTERN.test(cleanAcc)) {
      setError('Bank account number must be 8 to 25 digits.');
      return;
    }

    const cleanIfsc = ifsc.trim().toUpperCase();
    if (!IFSC_PATTERN.test(cleanIfsc)) {
      setError('Enter a valid IFSC code (e.g. HDFC0001234). The 5th character must be zero.');
      return;
    }

    const cleanBankName = bankName.trim().replace(/\s+/g, ' ');
    if (cleanBankName.length < 2) {
      setError('Enter your bank name as printed on the passbook (e.g. State Bank of India).');
      return;
    }

    const cleanBranch = bankBranch.trim();
    if (cleanBranch.length < 2) {
      setError('Enter your bank branch name as printed on the passbook (e.g. Anna Nagar, Chennai).');
      return;
    }

    if (!files.pan || !files.aadhaar || !files.aadhaarBack || !files.passbook) {
      setError('Please upload all 4 documents: PAN card, Aadhaar front, Aadhaar back and bank passbook / statement.');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('pan', cleanPan);
      formData.append('aadhaarReference', cleanAadhaar);
      formData.append('accountNumber', cleanAcc);
      formData.append('accountHolderName', cleanHolder);
      formData.append('ifsc', cleanIfsc);
      formData.append('bankName', cleanBankName);
      formData.append('bankBranch', cleanBranch);

      formData.append('panDocument', files.pan);
      formData.append('aadhaarDocument', files.aadhaar);
      formData.append('aadhaarBackDocument', files.aadhaarBack);
      formData.append('passbookDocument', files.passbook);

      await api.submitKyc(token, formData);

      setSuccess('Your KYC documents have been submitted. Our compliance team will review them and you will be notified of the outcome.');
      await onSubmitted();

      closeTimer.current = setTimeout(() => {
        closeTimer.current = null;
        setSuccess('');
        requestClose();
      }, 3000);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Unable to submit your KYC details. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 animate-overlay-in">
      {/* The whole dialog scrolls with the page: no nested scroll area, which some phone
          browsers paint unreliably. The footer stays pinned while the form scrolls. */}
      <div
        className="min-h-full flex items-start sm:items-center justify-center p-3 sm:p-6"
        onClick={(event) => {
          if (event.target === event.currentTarget) handleClose();
        }}
      >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-modal-title"
        className="w-full max-w-4xl rounded-2xl sm:rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 shadow-2xl relative focus:outline-none"
      >

        {/* Header */}
        <div className="px-5 sm:px-8 py-5 rounded-t-2xl sm:rounded-t-3xl border-b border-zinc-200 dark:border-white/10 flex items-start justify-between gap-4 bg-zinc-50/70 dark:bg-zinc-950/40">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 border border-blue-600/20 text-blue-600 dark:text-blue-500 flex items-center justify-center shrink-0 mt-0.5">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h3 id="kyc-modal-title" className="text-base sm:text-lg font-bold text-zinc-950 dark:text-white">
                  Identity verification (KYC)
                </h3>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  kycStatus === 'VERIFIED'
                    ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                    : isUnderReview
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    : isRejected
                    ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20'
                    : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10'
                }`}>
                  {kycStatus === 'VERIFIED' ? <CheckCircle2 className="w-3 h-3" /> : isUnderReview ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  <span>{kycStatus === 'DRAFT' ? 'Not submitted' : kycStatus.replaceAll('_', ' ')}</span>
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Verify your identity and the bank account used for payouts. Verified accounts get faster payout processing.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            aria-label="Close"
            className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition disabled:opacity-40 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-5 sm:p-8 space-y-6">

          {success && (
            <div role="status" className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs sm:text-sm flex items-start gap-3 animate-fade-in">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
              <div className="leading-relaxed font-medium">{success}</div>
            </div>
          )}

          {error && (
            <div role="alert" className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs sm:text-sm flex items-start gap-3 animate-fade-in">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="leading-relaxed font-medium">{error}</div>
            </div>
          )}

          {/* Rejection / Resubmission notice banner */}
          {isRejected && !success && (
            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
              <div className="space-y-1">
                <p className="font-bold text-xs sm:text-sm">Your previous submission was not approved</p>
                <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {rejectionReason || 'Your previous verification documents could not be approved. Please update your details or upload clearer, uncropped copies below.'}
                </p>
              </div>
            </div>
          )}

          {kycStatus === 'VERIFIED' && !success ? (
            <div className="space-y-6 py-2">
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-zinc-950 dark:text-white">Your identity is verified</h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1 leading-relaxed">
                    No further action is needed. Your KYC documents have been approved by the compliance team.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : isUnderReview && !success ? (
            <div className="space-y-6 py-2">
              <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/10 space-y-6">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <h4 className="text-sm font-bold text-zinc-950 dark:text-white">Your application is being reviewed</h4>
                </div>

                <ol className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <li className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-blue-600/30 dark:border-blue-600/20 relative">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-600 text-xs font-bold mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>1. Submitted</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Identity details and 3 verification documents received.
                    </p>
                  </li>

                  <li className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 relative" aria-current="step">
                    <div className="flex items-center gap-2 text-xs font-bold mb-1">
                      <Clock className="w-4 h-4" />
                      <span>2. Compliance review</span>
                    </div>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                      Our compliance team is reviewing your documents.
                    </p>
                  </li>

                  <li className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-zinc-400 dark:text-zinc-500 relative opacity-75">
                    <div className="flex items-center gap-2 text-xs font-bold mb-1">
                      <ShieldCheck className="w-4 h-4" />
                      <span>3. Verified</span>
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      Your account is marked as verified once the review is approved.
                    </p>
                  </li>
                </ol>

                <div className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed bg-white/60 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200/80 dark:border-white/[0.06]">
                  Your documents are in the review queue. You will be notified as soon as the review is complete.
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 text-xs font-semibold hover:opacity-90 transition"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <form id="kycVerificationForm" onSubmit={handleSubmit} className="space-y-6" noValidate>

              <div className="p-3.5 rounded-xl bg-blue-600/5 dark:bg-blue-600/10 border border-blue-600/20 text-xs text-blue-700 dark:text-blue-300 flex items-center gap-2">
                <Lock className="w-4 h-4 shrink-0 text-blue-600" />
                <span>Your documents are sent over an encrypted connection and are only visible to the compliance team.</span>
              </div>

              {/* Section 1: National Identity */}
              <fieldset disabled={submitting || Boolean(success)} className="p-5 sm:p-6 rounded-2xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.08] space-y-4 min-w-0">
                <legend className="sr-only">Identity details</legend>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-zinc-200 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      1. Identity details
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-medium">Government issued</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="kyc-pan" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        PAN <span className="text-blue-600" aria-hidden="true">*</span>
                      </label>
                      {PAN_PATTERN.test(pan.trim()) && <ValidTag>Valid PAN</ValidTag>}
                    </div>
                    <input
                      id="kyc-pan"
                      type="text"
                      required
                      maxLength={10}
                      autoComplete="off"
                      placeholder="ABCDE1234F"
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      aria-describedby="kyc-pan-help"
                      className={`${kycInputClass} uppercase font-mono tracking-wider`}
                    />
                    <p id="kyc-pan-help" className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                      10-character PAN issued by the Income Tax Department.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="kyc-aadhaar" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        Aadhaar number / reference <span className="text-blue-600" aria-hidden="true">*</span>
                      </label>
                      {AADHAAR_PATTERN.test(aadhaarReference.trim().replace(/\s+/g, '')) && <ValidTag>Looks valid</ValidTag>}
                    </div>
                    <input
                      id="kyc-aadhaar"
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={20}
                      autoComplete="off"
                      placeholder="12-digit Aadhaar or Virtual ID"
                      value={aadhaarReference}
                      onChange={(e) => setAadhaarReference(e.target.value)}
                      aria-describedby="kyc-aadhaar-help"
                      className={`${kycInputClass} font-mono tracking-wider`}
                    />
                    <p id="kyc-aadhaar-help" className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                      Your 12-digit Aadhaar number or 16-digit Virtual ID (digits only).
                    </p>
                  </div>
                </div>
              </fieldset>

              {/* Section 2: Banking & Payout Settlement */}
              <fieldset disabled={submitting || Boolean(success)} className="p-5 sm:p-6 rounded-2xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.08] space-y-4 min-w-0">
                <legend className="sr-only">Bank account details</legend>
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      2. Bank account for payouts
                    </h4>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="kyc-holder" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                      Account holder name <span className="text-blue-600" aria-hidden="true">*</span>
                    </label>
                    {accountHolderName.trim().length >= 2 && <ValidTag>Name entered</ValidTag>}
                  </div>
                  <input
                    id="kyc-holder"
                    type="text"
                    required
                    maxLength={255}
                    autoComplete="name"
                    placeholder="Name exactly as printed on your bank passbook"
                    value={accountHolderName}
                    onChange={(e) => setEditedHolderName(e.target.value)}
                    aria-describedby="kyc-holder-help"
                    className={kycInputClass}
                  />
                  <p id="kyc-holder-help" className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                    Must match the name on your PAN and bank account. Payouts are only made to accounts in your name.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="kyc-account" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        Bank account number <span className="text-blue-600" aria-hidden="true">*</span>
                      </label>
                      {ACCOUNT_PATTERN.test(accountNumber.trim()) && <ValidTag>Valid account</ValidTag>}
                    </div>
                    <input
                      id="kyc-account"
                      type="text"
                      inputMode="numeric"
                      required
                      maxLength={25}
                      autoComplete="off"
                      placeholder="8 to 25 digits"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                      aria-describedby="kyc-account-help"
                      className={`${kycInputClass} font-mono tracking-wider`}
                    />
                    <p id="kyc-account-help" className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                      Your active savings or current account number (digits only).
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="kyc-ifsc" className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                        IFSC code <span className="text-blue-600" aria-hidden="true">*</span>
                      </label>
                      {IFSC_PATTERN.test(ifsc.trim()) && <ValidTag>Valid IFSC</ValidTag>}
                    </div>
                    <input
                      id="kyc-ifsc"
                      type="text"
                      required
                      maxLength={11}
                      autoComplete="off"
                      placeholder="HDFC0001234"
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      aria-describedby="kyc-ifsc-help"
                      className={`${kycInputClass} uppercase font-mono tracking-wider`}
                    />
                    <p id="kyc-ifsc-help" className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                      11 characters (e.g. HDFC0001234). The 5th character is always zero.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="kyc-bank-name" className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                      Bank name <span className="text-blue-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="kyc-bank-name"
                      type="text"
                      required
                      maxLength={100}
                      autoComplete="off"
                      placeholder="e.g. State Bank of India"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      aria-describedby="kyc-bank-name-help"
                      className={kycInputClass}
                    />
                    <p id="kyc-bank-name-help" className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                      The full bank name, as printed on your passbook or cheque.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="kyc-branch" className="block text-xs font-semibold text-zinc-800 dark:text-zinc-200 mb-1.5">
                      Bank branch <span className="text-blue-600" aria-hidden="true">*</span>
                    </label>
                    <input
                      id="kyc-branch"
                      type="text"
                      required
                      maxLength={100}
                      autoComplete="off"
                      placeholder="e.g. Anna Nagar, Chennai"
                      value={bankBranch}
                      onChange={(e) => setBankBranch(e.target.value)}
                      aria-describedby="kyc-branch-help"
                      className={kycInputClass}
                    />
                    <p id="kyc-branch-help" className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1.5">
                      The branch name printed on your passbook or statement.
                    </p>
                  </div>
                </div>
              </fieldset>

              {/* Section 3: Document Uploads */}
              <div className="p-5 sm:p-6 rounded-2xl bg-zinc-50/80 dark:bg-zinc-950/60 border border-zinc-200 dark:border-white/[0.08] space-y-4 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-x-3 gap-y-1 border-b border-zinc-200 dark:border-white/10 pb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-4 h-4 text-blue-600 shrink-0" />
                    <h4 className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                      3. Documents
                    </h4>
                  </div>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium sm:text-right">
                    JPEG, PNG, WEBP or PDF, up to 5 MB each
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <DocumentCard
                    title="PAN card"
                    file={files.pan}
                    uploadLabel="Click to upload"
                    hint="Clear front photo or PDF"
                    disabled={submitting || Boolean(success)}
                    onSelect={(file) => handleFileSelect('pan', file)}
                    onRemove={() => setFiles((current) => ({ ...current, pan: null }))}
                  />
                  <DocumentCard
                    title="Aadhaar card - front"
                    file={files.aadhaar}
                    uploadLabel="Click to upload"
                    hint="Side with your photo and Aadhaar number"
                    disabled={submitting || Boolean(success)}
                    onSelect={(file) => handleFileSelect('aadhaar', file)}
                    onRemove={() => setFiles((current) => ({ ...current, aadhaar: null }))}
                  />
                  <DocumentCard
                    title="Aadhaar card - back"
                    file={files.aadhaarBack}
                    uploadLabel="Click to upload"
                    hint="Side with your address"
                    disabled={submitting || Boolean(success)}
                    onSelect={(file) => handleFileSelect('aadhaarBack', file)}
                    onRemove={() => setFiles((current) => ({ ...current, aadhaarBack: null }))}
                  />
                  <DocumentCard
                    title="Bank passbook"
                    file={files.passbook}
                    uploadLabel="Click to upload"
                    hint="Passbook page, statement or cancelled cheque"
                    disabled={submitting || Boolean(success)}
                    onSelect={(file) => handleFileSelect('passbook', file)}
                    onRemove={() => setFiles((current) => ({ ...current, passbook: null }))}
                  />
                </div>
              </div>

            </form>
          )}

        </div>

        {/* Footer Bar */}
        {(showForm || success) && (
          <div className="sticky bottom-0 px-5 sm:px-8 py-4 rounded-b-2xl sm:rounded-b-3xl bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-[11px] sm:text-xs min-w-0">
              <Lock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>Identity verification in line with AML / KYC guidelines.</span>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs transition disabled:opacity-50"
              >
                {success ? 'Close' : 'Cancel'}
              </button>
              {!success && (
                <button
                  type="submit"
                  form="kycVerificationForm"
                  disabled={submitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition active:scale-98 shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? <Spinner className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{submitting ? 'Submitting...' : 'Submit for verification'}</span>
                </button>
              )}
            </div>
          </div>
        )}

      </div>
      </div>
    </div>
  );
}
