import React, { useState, useEffect, useRef, useId } from 'react';
import { BadgeCheck, Loader2, Upload, X } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useCompleteWithdrawal } from '../hooks/useFinance';
import { useToast } from '../context/ToastContext';
import { AdminWithdrawal } from '../types';
import { Field, FormError, inputClass, textareaClass, btnGhostClass, btnSuccessClass, labelClass } from './ui';
import { formatINR, getApiErrorMessage } from '../utils/finance';

interface CompleteWithdrawalModalProps {
  withdrawal: AdminWithdrawal | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const REFERENCE_PATTERN = /^[A-Za-z0-9/_-]{6,50}$/;

export const CompleteWithdrawalModal: React.FC<CompleteWithdrawalModalProps> = ({
  withdrawal,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const { mutateAsync: completeWithdrawal, isPending } = useCompleteWithdrawal();
  const { toast } = useToast();

  // Reset the form every time the dialog opens
  useEffect(() => {
    if (isOpen) {
      setPaymentReference('');
      setRemarks('');
      setProof(null);
      setReferenceError(null);
      setFormError(null);
    }
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected after an error
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFormError('Payment proof must be a JPEG, PNG, WEBP or PDF file');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFormError('Payment proof must be 5MB or smaller');
      return;
    }

    setProof(file);
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawal || isPending) return;

    const reference = paymentReference.trim();
    if (!REFERENCE_PATTERN.test(reference)) {
      setReferenceError('Payment reference must be 6-50 letters or digits without spaces');
      return;
    }
    setReferenceError(null);
    setFormError(null);

    const formData = new FormData();
    formData.append('paymentReference', reference);
    if (remarks.trim()) formData.append('remarks', remarks.trim());
    if (proof) formData.append('paymentProof', proof);

    try {
      await completeWithdrawal({ id: withdrawal.id, formData });
      toast.success(
        `${withdrawal.reference} marked as paid. ${formatINR(withdrawal.netAmount)} recorded as paid out.`,
        'Withdrawal completed'
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to complete the withdrawal');
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen && !!withdrawal}
      onClose={onClose}
      title="Mark as Paid"
      subtitle={withdrawal ? <span className="font-mono">{withdrawal.reference}</span> : undefined}
      icon={BadgeCheck}
      tone="success"
      maxWidthClass="max-w-lg"
      disableClose={isPending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isPending} className={btnGhostClass}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isPending} className={btnSuccessClass}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <BadgeCheck className="w-4 h-4" />
                Mark as Completed
              </>
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormError message={formError} />

        {withdrawal && (
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Confirm that <strong className="text-slate-900 dark:text-white">{formatINR(withdrawal.netAmount)}</strong>{' '}
            {Number(withdrawal.feeAmount) > 0 && (
              <span className="text-slate-500">
                ({formatINR(withdrawal.totalAmount)} less the {withdrawal.feePercent}% fee of {formatINR(withdrawal.feeAmount)})
              </span>
            )}{' '}
            has been paid to{' '}
            <strong className="text-slate-900 dark:text-white">
              {withdrawal.customerName || withdrawal.customerEmail || 'the customer'}
            </strong>{' '}
            by {withdrawal.payoutMethod === 'UPI' ? 'UPI' : 'bank transfer'}. Only complete this after the money has
            actually been sent.
          </p>
        )}

        <Field
          label="Payment reference (UTR / transaction ID)"
          htmlFor={`${formId}-reference`}
          required
          error={referenceError}
          hint="6-50 letters or digits, no spaces"
        >
          <input
            id={`${formId}-reference`}
            type="text"
            value={paymentReference}
            onChange={(e) => {
              setPaymentReference(e.target.value);
              setReferenceError(null);
            }}
            maxLength={50}
            placeholder="e.g. HDFCN52026092812345"
            className={`${inputClass} font-mono uppercase`}
          />
        </Field>

        <Field label="Remarks" htmlFor={`${formId}-remarks`} optional>
          <textarea
            id={`${formId}-remarks`}
            rows={2}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            maxLength={1000}
            placeholder="Internal notes about this payout"
            className={textareaClass}
          />
        </Field>

        <div>
          <label htmlFor={`${formId}-proof`} className={labelClass}>
            Payment proof <span className="text-slate-400 font-medium">(Optional)</span>
          </label>
          <input
            id={`${formId}-proof`}
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
            onChange={handleFileChange}
            className="sr-only"
          />
          {proof ? (
            <div className="flex items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{proof.name}</p>
                <p className="text-[10px] text-slate-400">{(proof.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={() => setProof(null)}
                aria-label="Remove file"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-3 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:border-brand-500 flex items-center justify-center gap-1.5 transition"
            >
              <Upload className="w-3.5 h-3.5 text-brand-500" />
              <span>Upload screenshot or PDF (max 5MB)</span>
            </button>
          )}
        </div>
      </form>
    </ModalShell>
  );
};
