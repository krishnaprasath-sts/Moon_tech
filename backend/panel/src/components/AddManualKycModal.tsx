import React, { useState, useEffect, useId } from 'react';
import { ShieldCheck, CheckCircle2, Clock, Loader2, X } from 'lucide-react';
import { ModalShell } from './ModalShell';
import { useManualSubmitKyc, useCustomers } from '../hooks';
import { useToast } from '../context/ToastContext';
import { KycStatus } from '../types';
import { Field, FormError, inputClass, btnGhostClass, btnPrimaryClass, labelClass } from './ui';
import { getApiErrorMessage } from '../utils/finance';

interface AddManualKycModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  preselectedCustomerId?: number | string;
  preselectedCustomerName?: string;
}

type DocKey = 'passbook' | 'pan' | 'aadhaar' | 'aadhaarBack';

const DOCUMENTS: Array<{ key: DocKey; label: string; field: string }> = [
  { key: 'passbook', label: 'Bank passbook / statement', field: 'passbookDocument' },
  { key: 'pan', label: 'PAN card', field: 'panDocument' },
  { key: 'aadhaar', label: 'Aadhaar card (front)', field: 'aadhaarDocument' },
  { key: 'aadhaarBack', label: 'Aadhaar card (back)', field: 'aadhaarBackDocument' },
];

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_PATTERN = /^\d{8,25}$/;

const EMPTY_FORM = {
  customerId: '',
  pan: '',
  aadhaarReference: '',
  accountHolderName: '',
  accountNumber: '',
  ifsc: '',
  bankName: '',
  bankBranch: '',
  remarks: '',
};

type FormState = typeof EMPTY_FORM;
type FormErrors = Partial<Record<keyof FormState, string>>;

export const AddManualKycModal: React.FC<AddManualKycModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  preselectedCustomerId,
  preselectedCustomerName,
}) => {
  const formId = useId();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<KycStatus.PENDING | KycStatus.VERIFIED>(KycStatus.VERIFIED);
  const [files, setFiles] = useState<Record<DocKey, File | null>>({ passbook: null, pan: null, aadhaar: null, aadhaarBack: null });
  const [errors, setErrors] = useState<FormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  // The customer picker is only needed when no customer was preselected
  const { data: customersData, isLoading: isLoadingCustomers } = useCustomers(
    { limit: 100 },
    { enabled: isOpen && !preselectedCustomerId }
  );
  const { mutateAsync: submitKyc, isPending } = useManualSubmitKyc();
  const { toast } = useToast();

  // Reset the form every time the dialog opens
  useEffect(() => {
    if (isOpen) {
      setForm({ ...EMPTY_FORM, customerId: preselectedCustomerId ? String(preselectedCustomerId) : '' });
      setStatus(KycStatus.VERIFIED);
      setFiles({ passbook: null, pan: null, aadhaar: null, aadhaarBack: null });
      setErrors({});
      setFormError(null);
    }
  }, [isOpen, preselectedCustomerId]);

  const update =
    (key: keyof FormState, transform?: (value: string) => string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const value = transform ? transform(e.target.value) : e.target.value;
      setForm((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => ({ ...prev, [key]: undefined }));
    };

  const handleFileChange = (key: DocKey) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be re-selected after an error
    e.target.value = '';
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setFormError('Documents must be JPEG, PNG, WEBP or PDF files');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFormError('Each document must be 5MB or smaller');
      return;
    }
    setFormError(null);
    setFiles((prev) => ({ ...prev, [key]: file }));
  };

  const validate = (): boolean => {
    const next: FormErrors = {};
    if (!form.customerId) next.customerId = 'Select the customer this KYC belongs to';
    if (!PAN_PATTERN.test(form.pan.trim())) next.pan = 'PAN must be 10 characters, e.g. ABCDE1234F';
    if (!form.aadhaarReference.trim()) next.aadhaarReference = 'Aadhaar reference is required';
    if (form.accountHolderName.trim().length < 2) next.accountHolderName = 'Enter the account holder name';
    if (!ACCOUNT_PATTERN.test(form.accountNumber.trim())) next.accountNumber = 'Account number must be 8-25 digits';
    if (!IFSC_PATTERN.test(form.ifsc.trim())) next.ifsc = 'IFSC must be 11 characters, e.g. HDFC0001234';
    const bankName = form.bankName.trim();
    if (bankName.length < 2 || bankName.length > 100) next.bankName = 'Enter the bank name (2-100 characters)';
    if (form.bankBranch.trim().length < 2) next.bankBranch = 'Enter the bank branch name';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    setFormError(null);
    if (!validate()) return;

    const formData = new FormData();
    formData.append('customerId', form.customerId);
    formData.append('pan', form.pan.trim().toUpperCase());
    formData.append('aadhaarReference', form.aadhaarReference.trim());
    formData.append('accountNumber', form.accountNumber.trim());
    formData.append('accountHolderName', form.accountHolderName.trim());
    formData.append('ifsc', form.ifsc.trim().toUpperCase());
    formData.append('bankName', form.bankName.trim());
    formData.append('bankBranch', form.bankBranch.trim());
    formData.append('status', status);
    if (form.remarks.trim()) formData.append('remarks', form.remarks.trim());
    DOCUMENTS.forEach((doc) => {
      const file = files[doc.key];
      if (file) formData.append(doc.field, file);
    });

    try {
      await submitKyc(formData);
      toast.success(
        status === KycStatus.VERIFIED
          ? 'KYC record saved and marked as verified'
          : 'KYC record saved and added to the review queue',
        'KYC submitted'
      );
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to submit the KYC record');
      setFormError(msg);
      toast.error(msg);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      title="Manual KYC Submission"
      subtitle="Enter identity and bank details on the customer's behalf"
      icon={ShieldCheck}
      maxWidthClass="max-w-3xl"
      disableClose={isPending}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={isPending} className={btnGhostClass}>
            Cancel
          </button>
          <button type="submit" form={formId} disabled={isPending} className={btnPrimaryClass}>
            {isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : status === KycStatus.VERIFIED ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Save & Verify KYC
              </>
            ) : (
              <>
                <Clock className="w-4 h-4" />
                Submit to Queue
              </>
            )}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormError message={formError} />

        {/* Customer */}
        <Field label="Customer" htmlFor={`${formId}-customer`} required error={errors.customerId}>
          {preselectedCustomerId ? (
            <div
              id={`${formId}-customer`}
              className="p-3 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white font-medium flex items-center justify-between gap-2"
            >
              <span className="truncate">
                {preselectedCustomerName || 'Customer'} <span className="text-slate-500">(#{preselectedCustomerId})</span>
              </span>
              <span className="text-[10px] text-brand-600 dark:text-brand-400 uppercase font-bold flex-shrink-0">Selected</span>
            </div>
          ) : (
            <select
              id={`${formId}-customer`}
              value={form.customerId}
              onChange={update('customerId')}
              disabled={isLoadingCustomers}
              className={inputClass}
            >
              <option value="">{isLoadingCustomers ? 'Loading customers...' : 'Select a customer...'}</option>
              {customersData?.customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} - {c.fullName} ({c.email})
                </option>
              ))}
            </select>
          )}
        </Field>

        {/* Identity */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
            Identity documents
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="PAN number" htmlFor={`${formId}-pan`} required error={errors.pan}>
              <input
                id={`${formId}-pan`}
                type="text"
                value={form.pan}
                onChange={update('pan', (v) => v.toUpperCase())}
                placeholder="ABCDE1234F"
                maxLength={10}
                className={`${inputClass} uppercase font-mono`}
              />
            </Field>

            <Field label="Aadhaar reference" htmlFor={`${formId}-aadhaar`} required error={errors.aadhaarReference}>
              <input
                id={`${formId}-aadhaar`}
                type="text"
                inputMode="numeric"
                value={form.aadhaarReference}
                onChange={update('aadhaarReference')}
                placeholder="12-digit Aadhaar number"
                maxLength={20}
                className={`${inputClass} font-mono`}
              />
            </Field>
          </div>
        </div>

        {/* Bank */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3">
            Bank account
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Field label="Account holder name" htmlFor={`${formId}-holder`} required error={errors.accountHolderName}>
              <input
                id={`${formId}-holder`}
                type="text"
                value={form.accountHolderName}
                onChange={update('accountHolderName')}
                placeholder="As printed on the passbook"
                className={inputClass}
              />
            </Field>

            <Field label="Account number" htmlFor={`${formId}-account`} required error={errors.accountNumber}>
              <input
                id={`${formId}-account`}
                type="text"
                inputMode="numeric"
                value={form.accountNumber}
                onChange={update('accountNumber', (v) => v.replace(/\D/g, ''))}
                placeholder="8-25 digits"
                maxLength={25}
                className={`${inputClass} font-mono`}
              />
            </Field>

            <Field label="IFSC code" htmlFor={`${formId}-ifsc`} required error={errors.ifsc}>
              <input
                id={`${formId}-ifsc`}
                type="text"
                value={form.ifsc}
                onChange={update('ifsc', (v) => v.toUpperCase())}
                placeholder="HDFC0001234"
                maxLength={11}
                className={`${inputClass} uppercase font-mono`}
              />
            </Field>

            <Field label="Bank name" htmlFor={`${formId}-bank-name`} required error={errors.bankName}>
              <input
                id={`${formId}-bank-name`}
                type="text"
                value={form.bankName}
                onChange={update('bankName')}
                placeholder="e.g. HDFC Bank"
                maxLength={100}
                className={inputClass}
              />
            </Field>

            <Field label="Bank branch" htmlFor={`${formId}-bank-branch`} required error={errors.bankBranch}>
              <input
                id={`${formId}-bank-branch`}
                type="text"
                value={form.bankBranch}
                onChange={update('bankBranch')}
                placeholder="e.g. Anna Nagar, Chennai"
                maxLength={100}
                className={inputClass}
              />
            </Field>

            <Field label="Outcome" htmlFor={`${formId}-status`} required>
              <select
                id={`${formId}-status`}
                value={status}
                onChange={(e) => setStatus(e.target.value as KycStatus.PENDING | KycStatus.VERIFIED)}
                className={inputClass}
              >
                <option value={KycStatus.VERIFIED}>Mark as verified immediately</option>
                <option value={KycStatus.PENDING}>Add to the review queue (pending)</option>
              </select>
            </Field>
          </div>
        </div>

        {/* Documents */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
            Document uploads <span className="text-slate-400 font-medium normal-case tracking-normal">(Optional)</span>
          </h4>
          <p className="text-[10px] text-slate-400 mb-3">JPEG, PNG, WEBP or PDF, up to 5MB each.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {DOCUMENTS.map((doc) => {
              const file = files[doc.key];
              const inputId = `${formId}-file-${doc.key}`;
              return (
                <div
                  key={doc.key}
                  className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80"
                >
                  <label htmlFor={inputId} className={labelClass}>
                    {doc.label}
                  </label>
                  <input
                    id={inputId}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                    onChange={handleFileChange(doc.key)}
                    className="sr-only"
                  />
                  {file ? (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-slate-900 dark:text-white font-medium" title={file.name}>
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setFiles((prev) => ({ ...prev, [doc.key]: null }))}
                        aria-label={`Remove ${doc.label}`}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition flex-shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor={inputId}
                      className="block w-full text-center px-2 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:border-brand-500 cursor-pointer transition"
                    >
                      Choose file
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Remarks */}
        <Field label="Remarks" htmlFor={`${formId}-remarks`} optional className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <input
            id={`${formId}-remarks`}
            type="text"
            value={form.remarks}
            onChange={update('remarks')}
            maxLength={500}
            placeholder="e.g. Identity verified in person at the branch"
            className={inputClass}
          />
        </Field>
      </form>
    </ModalShell>
  );
};
