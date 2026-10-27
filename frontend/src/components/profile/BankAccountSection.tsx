"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { BadgeCheck, Clock, Eye, EyeOff, FileText, History, Info, RefreshCw, ShieldAlert, Trash2, UploadCloud } from 'lucide-react';
import { api, ApiError, BankChangeRequest, getErrorMessage, PayoutDetails } from '@/lib/api';
import { useAsyncData } from '@/lib/useAsyncData';
import { formatDate, formatDateTime, formatFileSize, validateReceiptFile } from '@/lib/format';
import {
  Alert,
  ErrorState,
  fieldErrorClass,
  helpTextClass,
  inputClass,
  labelClass,
  Modal,
  primaryButtonClass,
  RequiredMark,
  secondaryButtonClass,
  Spinner,
  StatusBadge,
} from '@/components/ui/primitives';

const IFSC_PATTERN = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
const ACCOUNT_PATTERN = /^[0-9]{8,25}$/;

/** Last 4 digits of a masked account number such as "XXXXXX1234". */
export function accountEnding(masked: string | null | undefined): string {
  if (!masked) return '';
  const digits = masked.replace(/\D/g, '');
  return digits.slice(-4);
}

/** Read-only state of the KYC / approved bank account plus the change-request workflow. */
export function BankAccountSection({
  token,
  details,
  defaultHolderName,
  onAccountChanged,
}: {
  token: string;
  details: PayoutDetails;
  defaultHolderName: string;
  /** Called after a request is created or cancelled so the parent can refresh the profile. */
  onAccountChanged?: () => void;
}) {
  const requestsFetcher = useCallback(() => api.getBankChangeRequests(token), [token]);
  const requests = useAsyncData(requestsFetcher);

  // Latest list returned by a mutation (avoids a refetch flash)
  const [localRequests, setLocalRequests] = useState<BankChangeRequest[] | null>(null);
  const list = useMemo(() => localRequests ?? requests.data ?? [], [localRequests, requests.data]);
  const pending = list.find((r) => r.status === 'PENDING') || null;
  const history = list.filter((r) => r.status !== 'PENDING');

  const [modalOpen, setModalOpen] = useState(false);
  const [success, setSuccess] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCreated = (created: BankChangeRequest) => {
    setLocalRequests([created, ...list.filter((r) => r.id !== created.id)]);
    setModalOpen(false);
    setSuccess(
      `Your request to change to the account ending ${accountEnding(created.accountNumberMasked)} has been submitted. ` +
        'Withdrawals continue to your current account until our team approves it.'
    );
    onAccountChanged?.();
  };

  const handleCancel = async () => {
    if (!pending || cancelling) return;
    setCancelError('');
    setCancelling(true);
    try {
      const updated = await api.cancelBankChangeRequest(token, pending.id);
      setLocalRequests(list.map((r) => (r.id === pending.id ? { ...r, ...updated, status: 'CANCELLED' } : r)));
      setConfirmingCancel(false);
      setSuccess('Your bank change request has been cancelled. Withdrawals continue to your current account.');
      onAccountChanged?.();
    } catch (err: unknown) {
      setCancelError(getErrorMessage(err, 'Unable to cancel the request. Please try again.'));
    } finally {
      setCancelling(false);
    }
  };

  const badge =
    details.bankSource === 'KYC' && details.bankVerified ? (
      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
        <BadgeCheck className="w-3.5 h-3.5" /> Verified from KYC
      </span>
    ) : details.bankSource === 'CHANGE_REQUEST' ? (
      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20">
        <BadgeCheck className="w-3.5 h-3.5" /> Approved change
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20">
        <ShieldAlert className="w-3.5 h-3.5" /> Not verified yet
      </span>
    );

  return (
    <div className="mt-5 space-y-4">
      {success && <Alert tone="success">{success}</Alert>}

      {/* Current account */}
      <div className="rounded-xl border border-zinc-200 dark:border-white/[0.08] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Withdrawals are paid to</div>
          {badge}
        </div>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
          <ReadOnlyRow label="Account holder" value={details.accountHolderName} />
          <ReadOnlyRow label="Account number" value={details.accountNumberMasked} mono />
          <ReadOnlyRow label="IFSC" value={details.ifscCode} mono />
          <ReadOnlyRow label="Bank" value={details.bankName} />
          <ReadOnlyRow label="Branch" value={details.bankBranch} />
          {details.bankVerifiedAt && <ReadOnlyRow label="Verified on" value={formatDate(details.bankVerifiedAt)} />}
        </dl>
        {!(details.bankSource === 'KYC' && details.bankVerified) && details.bankSource !== 'CHANGE_REQUEST' && (
          <p className={helpTextClass}>
            This account is verified together with your KYC documents. You can still request withdrawals to it in the meantime.
          </p>
        )}
      </div>

      {/* Pending request */}
      {pending && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/5 p-4 space-y-3" role="status">
          <div className="flex gap-3">
            <Clock className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div className="min-w-0 text-xs leading-relaxed text-amber-900 dark:text-amber-100">
              <p className="font-semibold">
                Change to account ending {accountEnding(pending.accountNumberMasked)} ({pending.bankName}) is waiting for approval
              </p>
              <p className="mt-0.5 text-amber-800/90 dark:text-amber-200/80">
                Submitted {formatDateTime(pending.createdAt)}. Withdrawals continue to your current account until our team
                approves the new one, usually within 1 working day.
              </p>
            </div>
          </div>
          {cancelError && <Alert>{cancelError}</Alert>}
          {confirmingCancel ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-end">
              <span className="text-xs font-medium text-amber-900 dark:text-amber-100 sm:mr-auto">Cancel this request?</span>
              <button
                type="button"
                onClick={() => setConfirmingCancel(false)}
                disabled={cancelling}
                className={`${secondaryButtonClass} min-h-11`}
              >
                Keep request
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="inline-flex items-center justify-center gap-1.5 min-h-11 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-50 text-xs font-semibold transition"
              >
                {cancelling && <Spinner />}
                <span>{cancelling ? 'Cancelling...' : 'Yes, cancel request'}</span>
              </button>
            </div>
          ) : (
            <div className="flex justify-end">
              <button type="button" onClick={() => setConfirmingCancel(true)} className={`${secondaryButtonClass} min-h-11`}>
                Cancel request
              </button>
            </div>
          )}
        </div>
      )}

      {requests.error && !requests.data && !localRequests && (
        <ErrorState message={requests.error} onRetry={requests.reload} />
      )}

      {/* Request a change */}
      {!pending && (
        <div className="rounded-xl bg-zinc-50 dark:bg-black/20 border border-zinc-100 dark:border-white/[0.06] p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-px text-zinc-400" aria-hidden="true" />
            <span>
              For your security, the bank account can only be changed after our team checks a proof document for the new
              account.
            </span>
          </p>
          <button
            type="button"
            onClick={() => {
              setSuccess('');
              setModalOpen(true);
            }}
            disabled={requests.loading && !requests.data && !localRequests}
            className={`shrink-0 ${primaryButtonClass} min-h-11`}
          >
            <RefreshCw className="w-3.5 h-3.5" /> Request bank change
          </button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold mb-2 flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" /> Change history
          </div>
          <ol className="divide-y divide-zinc-100 dark:divide-white/[0.06] rounded-xl border border-zinc-200 dark:border-white/[0.08]">
            {history.map((r) => (
              <li key={r.id} className="p-3 text-xs flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-zinc-800 dark:text-zinc-200">
                    {r.bankName} · <span className="font-mono">{r.accountNumberMasked}</span>
                  </span>
                  <StatusBadge status={r.status} kind="bankChange" />
                </div>
                <div className="text-[11px] text-zinc-500">
                  Requested {formatDateTime(r.createdAt)}
                  {r.reviewedAt && ` · Reviewed ${formatDateTime(r.reviewedAt)}`}
                </div>
                {r.status === 'REJECTED' && r.adminRemarks && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                    <span className="font-semibold">Reviewer&apos;s note:</span> {r.adminRemarks}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}

      {modalOpen && (
        <BankChangeModal
          token={token}
          current={details}
          defaultHolderName={details.accountHolderName || defaultHolderName}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

function ReadOnlyRow({ label, value, mono = false }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex justify-between sm:block gap-4 min-w-0">
      <dt className="text-zinc-500">{label}</dt>
      <dd className={`text-zinc-900 dark:text-zinc-100 font-medium text-right sm:text-left break-all ${mono ? 'font-mono' : ''}`}>
        {value || '—'}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Change request form
// ---------------------------------------------------------------------------
type ChangeField =
  | 'accountHolderName'
  | 'accountNumber'
  | 'confirmAccountNumber'
  | 'ifscCode'
  | 'bankName'
  | 'bankBranch'
  | 'reason'
  | 'currentPassword'
  | 'proof';

const CHANGE_FIELDS: ChangeField[] = [
  'accountHolderName',
  'accountNumber',
  'confirmAccountNumber',
  'ifscCode',
  'bankName',
  'bankBranch',
  'reason',
  'currentPassword',
  'proof',
];

function BankChangeModal({
  token,
  current,
  defaultHolderName,
  onClose,
  onCreated,
}: {
  token: string;
  current: PayoutDetails;
  defaultHolderName: string;
  onClose: () => void;
  onCreated: (request: BankChangeRequest) => void;
}) {
  const [accountHolderName, setAccountHolderName] = useState(defaultHolderName);
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [reason, setReason] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<ChangeField, string>>>({});

  const handleFile = (file: File | null) => {
    if (!file) return;
    const problem = validateReceiptFile(file);
    if (problem) {
      setFieldErrors((prev) => ({ ...prev, proof: `${file.name}: ${problem}` }));
      return;
    }
    setFieldErrors((prev) => ({ ...prev, proof: undefined }));
    setProof(file);
  };

  const validate = (): Partial<Record<ChangeField, string>> => {
    const errors: Partial<Record<ChangeField, string>> = {};
    if (accountHolderName.trim().length < 2) errors.accountHolderName = 'Account holder name must be at least 2 characters.';
    if (!ACCOUNT_PATTERN.test(accountNumber)) errors.accountNumber = 'Bank account number must be 8 to 25 digits.';
    if (!confirmAccountNumber) errors.confirmAccountNumber = 'Re-enter the account number to confirm it.';
    else if (confirmAccountNumber !== accountNumber) errors.confirmAccountNumber = 'The account numbers do not match.';
    if (!IFSC_PATTERN.test(ifscCode)) errors.ifscCode = 'Enter a valid IFSC code (e.g. HDFC0001234). The 5th character must be zero.';
    const cleanBank = bankName.trim();
    if (cleanBank.length < 2 || cleanBank.length > 100) errors.bankName = 'Enter the bank name (2 to 100 characters).';
    const cleanBranch = bankBranch.trim();
    if (cleanBranch.length < 2 || cleanBranch.length > 100) errors.bankBranch = 'Enter the branch name (2 to 100 characters).';
    if (reason.trim().length > 500) errors.reason = 'Keep the reason under 500 characters.';
    if (!currentPassword) errors.currentPassword = 'Enter your account password to confirm this change.';
    if (!proof) errors.proof = 'Upload a proof document for the new account.';
    return errors;
  };

  const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !proof) {
      setError('Please correct the highlighted fields.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createBankChangeRequest(token, {
        accountHolderName: accountHolderName.trim(),
        accountNumber,
        confirmAccountNumber,
        ifscCode: ifscCode.toUpperCase(),
        bankName: bankName.trim().replace(/\s+/g, ' '),
        bankBranch: bankBranch.trim(),
        reason: reason.trim() || undefined,
        currentPassword,
        proof,
      });
      onCreated(created);
    } catch (err: unknown) {
      const next: Partial<Record<ChangeField, string>> = {};
      if (err instanceof ApiError) {
        for (const fe of err.errors) {
          const field = fe.field as ChangeField;
          if (CHANGE_FIELDS.includes(field) && !next[field]) next[field] = fe.message;
        }
      }
      setFieldErrors(next);
      if (next.currentPassword) setCurrentPassword('');
      setError(getErrorMessage(err, 'Unable to submit your bank change request. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  };

  const fieldProps = (field: ChangeField, helpId?: string) => ({
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `bcr-${field}-error` : helpId,
  });

  const fieldError = (field: ChangeField) =>
    fieldErrors[field] ? (
      <p id={`bcr-${field}-error`} className={fieldErrorClass}>
        {fieldErrors[field]}
      </p>
    ) : null;

  const ending = accountEnding(current.accountNumberMasked);

  return (
    <Modal
      title="Request bank account change"
      description={`Withdrawals continue to your current account${ending ? ` ending ${ending}` : ''} until our team approves the new one, usually within 1 working day.`}
      onClose={onClose}
      closeDisabled={submitting}
      width="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && <Alert>{error}</Alert>}

        <div>
          <label htmlFor="bcr-holder" className={labelClass}>Account holder name<RequiredMark /></label>
          <input
            id="bcr-holder"
            type="text"
            maxLength={255}
            autoComplete="name"
            placeholder="Name as printed on the bank account"
            value={accountHolderName}
            onChange={(e) => setAccountHolderName(e.target.value)}
            disabled={submitting}
            className={`${inputClass} min-h-11`}
            {...fieldProps('accountHolderName', 'bcr-holder-help')}
          />
          {fieldErrors.accountHolderName ? fieldError('accountHolderName') : (
            <p id="bcr-holder-help" className={helpTextClass}>The account must be in your own name.</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="bcr-account" className={labelClass}>New account number<RequiredMark /></label>
            <input
              id="bcr-account"
              type="text"
              inputMode="numeric"
              maxLength={25}
              autoComplete="off"
              placeholder="8 to 25 digits"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
              disabled={submitting}
              className={`${inputClass} min-h-11 font-mono tracking-wider`}
              {...fieldProps('accountNumber')}
            />
            {fieldError('accountNumber')}
          </div>
          <div>
            <label htmlFor="bcr-account-confirm" className={labelClass}>Confirm account number<RequiredMark /></label>
            <input
              id="bcr-account-confirm"
              type="text"
              inputMode="numeric"
              maxLength={25}
              autoComplete="off"
              placeholder="Re-enter the number"
              value={confirmAccountNumber}
              onChange={(e) => setConfirmAccountNumber(e.target.value.replace(/\D/g, ''))}
              disabled={submitting}
              className={`${inputClass} min-h-11 font-mono tracking-wider`}
              {...fieldProps('confirmAccountNumber')}
            />
            {fieldError('confirmAccountNumber')}
          </div>
          <div>
            <label htmlFor="bcr-ifsc" className={labelClass}>IFSC code<RequiredMark /></label>
            <input
              id="bcr-ifsc"
              type="text"
              maxLength={11}
              autoComplete="off"
              placeholder="HDFC0001234"
              value={ifscCode}
              onChange={(e) => setIfscCode(e.target.value.toUpperCase().trim())}
              disabled={submitting}
              className={`${inputClass} min-h-11 font-mono tracking-wider uppercase`}
              {...fieldProps('ifscCode', 'bcr-ifsc-help')}
            />
            {fieldErrors.ifscCode ? fieldError('ifscCode') : (
              <p id="bcr-ifsc-help" className={helpTextClass}>11 characters; the 5th is always zero.</p>
            )}
          </div>
          <div>
            <label htmlFor="bcr-bank" className={labelClass}>Bank name<RequiredMark /></label>
            <input
              id="bcr-bank"
              type="text"
              maxLength={100}
              autoComplete="off"
              placeholder="e.g. State Bank of India"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              disabled={submitting}
              className={`${inputClass} min-h-11`}
              {...fieldProps('bankName')}
            />
            {fieldError('bankName')}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="bcr-branch" className={labelClass}>Bank branch<RequiredMark /></label>
            <input
              id="bcr-branch"
              type="text"
              maxLength={100}
              autoComplete="off"
              placeholder="e.g. Anna Nagar, Chennai"
              value={bankBranch}
              onChange={(e) => setBankBranch(e.target.value)}
              disabled={submitting}
              className={`${inputClass} min-h-11`}
              {...fieldProps('bankBranch')}
            />
            {fieldError('bankBranch')}
          </div>
        </div>

        <div>
          <label htmlFor="bcr-reason" className={labelClass}>Reason for the change</label>
          <textarea
            id="bcr-reason"
            rows={2}
            maxLength={500}
            placeholder="Optional, e.g. old account closed"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            className={`${inputClass} resize-y`}
            {...fieldProps('reason')}
          />
          {fieldError('reason')}
        </div>

        {/* Proof */}
        <div>
          <span id="bcr-proof-label" className={labelClass}>
            Proof of the new account<RequiredMark />
          </span>
          {proof ? (
            <div className="p-2.5 rounded-xl bg-blue-600/5 dark:bg-blue-600/10 border border-blue-600/30 flex items-center gap-3">
              <div className="w-11 h-11 rounded-lg bg-zinc-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-zinc-500" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-zinc-900 dark:text-white" title={proof.name}>
                  {proof.name}
                </div>
                <div className="text-[10px] text-zinc-500 font-mono">{formatFileSize(proof.size)}</div>
              </div>
              <button
                type="button"
                onClick={() => setProof(null)}
                disabled={submitting}
                className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition disabled:opacity-50"
                aria-label="Remove proof document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <label
              className={`block text-center py-5 px-3 cursor-pointer rounded-xl border-2 border-dashed transition focus-within:border-blue-600 hover:border-blue-600 dark:hover:border-blue-500 hover:bg-blue-500/[0.03] ${
                fieldErrors.proof ? 'border-rose-500/60' : 'border-zinc-300 dark:border-white/15'
              }`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                handleFile(e.dataTransfer.files?.[0] || null);
              }}
            >
              <UploadCloud className="w-7 h-7 mx-auto mb-1.5 text-zinc-400" aria-hidden="true" />
              <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 block">Tap to upload or drag a file here</span>
              <span className="text-[10px] text-zinc-400 block mt-0.5">JPEG, PNG, WEBP or PDF, up to 5 MB</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                disabled={submitting}
                aria-labelledby="bcr-proof-label"
                aria-describedby={fieldErrors.proof ? 'bcr-proof-error' : 'bcr-proof-help'}
                onChange={(e) => {
                  handleFile(e.target.files?.[0] || null);
                  e.target.value = '';
                }}
                className="sr-only"
              />
            </label>
          )}
          {fieldErrors.proof ? fieldError('proof') : (
            <p id="bcr-proof-help" className={helpTextClass}>
              Passbook first page, a cancelled cheque or a recent bank statement showing your name, the account number and
              IFSC.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="bcr-password" className={labelClass}>Your account password<RequiredMark /></label>
          <div className="relative">
            <input
              id="bcr-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={submitting}
              className={`${inputClass} min-h-11 pr-12`}
              {...fieldProps('currentPassword', 'bcr-password-help')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-0 top-0 w-11 h-11 inline-flex items-center justify-center text-zinc-400 hover:text-zinc-700 dark:hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>
          {fieldErrors.currentPassword ? fieldError('currentPassword') : (
            <p id="bcr-password-help" className={helpTextClass}>Confirms it is really you making this change.</p>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3">
          <button type="button" onClick={onClose} disabled={submitting} className={`${secondaryButtonClass} min-h-11 sm:flex-1`}>
            Cancel
          </button>
          <button type="submit" disabled={submitting} className={`${primaryButtonClass} min-h-11 sm:flex-1`}>
            {submitting && <Spinner />}
            <span>{submitting ? 'Submitting...' : 'Submit for approval'}</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
